/* ================================================================
   Vitrine editável — leitura/escrita do que o painel controla.

   Regra do módulo: preço e código são do ERP e não passam por aqui.
   O que o painel guarda é só o que o Tiny escreve errado (nome,
   descrição) ou não tem (foto), mais o bloco de destaque da home.

   Imagem enviada pelo painel vira bytea no Postgres e é servida por
   /api/produtos?img=<alvo> — a Vercel só permite 12 funções em /api,
   então a rota pública de imagem pega carona na de produtos.
   ================================================================ */

import { getPool } from './db.js';

const MAX_IMAGEM = 2 * 1024 * 1024; // 2 MB (o corpo da função na Vercel é 4,5 MB e base64 infla 33%)
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** URL pública da imagem guardada no banco (com cache-buster). */
export function urlImagem(alvo, atualizadoEm) {
  const v = atualizadoEm ? new Date(atualizadoEm).getTime() : Date.now();
  return `/api/produtos?img=${encodeURIComponent(alvo)}&v=${v}`;
}

/* ── Destaque da home ─────────────────────────────────────────── */

export async function lerDestaque() {
  const { rows } = await getPool().query(
    `select id, ativo, badge, titulo, titulo_realce, texto, beneficios, sku,
            preco_prefixo, cta_label, cta_url, cta2_label, cta2_url,
            imagem_url, imagem_mime, atualizado_em,
            (imagem_bytes is not null) as tem_imagem
       from public.vitrine_destaque where id = 1`
  );
  const d = rows[0];
  if (!d) return null;
  const beneficios = Array.isArray(d.beneficios) ? d.beneficios : [];
  return {
    ativo: d.ativo,
    badge: d.badge,
    titulo: d.titulo,
    tituloRealce: d.titulo_realce,
    texto: d.texto,
    beneficios,
    sku: d.sku,
    precoPrefixo: d.preco_prefixo,
    ctaLabel: d.cta_label,
    ctaUrl: d.cta_url,
    cta2Label: d.cta2_label,
    cta2Url: d.cta2_url,
    imagem: d.tem_imagem ? urlImagem('destaque', d.atualizado_em) : d.imagem_url || null,
    imagemUrl: d.imagem_url || null,
    temImagemPropria: d.tem_imagem,
    atualizadoEm: d.atualizado_em,
  };
}

const CAMPOS_DESTAQUE = [
  'ativo', 'badge', 'titulo', 'titulo_realce', 'texto', 'sku',
  'preco_prefixo', 'cta_label', 'cta_url', 'cta2_label', 'cta2_url', 'imagem_url',
];

export async function salvarDestaque(body) {
  const sets = [];
  const vals = [];
  for (const campo of CAMPOS_DESTAQUE) {
    if (!(campo in body)) continue;
    vals.push(campo === 'ativo' ? Boolean(body[campo]) : normalizarTexto(body[campo]));
    sets.push(`${campo} = $${vals.length}`);
  }
  if ('beneficios' in body) {
    const lista = (Array.isArray(body.beneficios) ? body.beneficios : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    vals.push(JSON.stringify(lista));
    sets.push(`beneficios = $${vals.length}::jsonb`);
  }
  if (!sets.length) return lerDestaque();
  sets.push('atualizado_em = now()');
  await getPool().query(`update public.vitrine_destaque set ${sets.join(', ')} where id = 1`, vals);
  return lerDestaque();
}

/* ── Correções por produto ────────────────────────────────────── */

export async function lerOverrides() {
  const { rows } = await getPool().query(
    `select sku, nome, descricao, imagem_url, oculto, ordem, atualizado_em,
            (imagem_bytes is not null) as tem_imagem
       from public.vitrine_produtos`
  );
  const mapa = new Map();
  for (const r of rows) mapa.set(String(r.sku), r);
  return mapa;
}

/**
 * Aplica as correções sobre o catálogo do Tiny.
 * O produto continua sendo o do ERP: só o que foi corrigido muda.
 */
export function aplicarOverrides(produtos, overrides) {
  const lista = [];
  for (const p of produtos) {
    const o = overrides.get(String(p.sku));
    if (!o) {
      lista.push(p);
      continue;
    }
    if (o.oculto) continue;
    const imagem = o.tem_imagem ? urlImagem(p.sku, o.atualizado_em) : o.imagem_url || p.image;
    lista.push({
      ...p,
      name: (o.nome && o.nome.trim()) || p.name,
      nomeSistema: p.name,
      description: (o.descricao && o.descricao.trim()) || p.description,
      image: imagem,
      hasImage: Boolean(o.tem_imagem || o.imagem_url || p.hasImage),
      ordem: Number.isInteger(o.ordem) ? o.ordem : null,
    });
  }
  // Quem tem ordem definida vai para a frente, na ordem escolhida.
  const comOrdem = lista.filter((p) => Number.isInteger(p.ordem));
  const semOrdem = lista.filter((p) => !Number.isInteger(p.ordem));
  comOrdem.sort((a, b) => a.ordem - b.ordem);
  return [...comOrdem, ...semOrdem];
}

const CAMPOS_PRODUTO = ['nome', 'descricao', 'imagem_url', 'oculto', 'ordem'];

export async function salvarProduto(sku, body) {
  const code = String(sku || '').trim();
  if (!code) throw new Error('SKU obrigatório.');

  const presentes = CAMPOS_PRODUTO.filter((c) => c in body);
  if (!presentes.length) return;

  const valor = (campo) => {
    if (campo === 'oculto') return Boolean(body.oculto);
    if (campo === 'ordem') {
      const n = Number(body.ordem);
      return body.ordem === '' || body.ordem === null || !Number.isFinite(n) ? null : Math.trunc(n);
    }
    return normalizarTexto(body[campo]);
  };

  const colunas = ['sku', ...presentes];
  const vals = [code, ...presentes.map(valor)];
  const placeholders = colunas.map((_, i) => `$${i + 1}`);
  const updates = presentes.map((c, i) => `${c} = $${i + 2}`);
  updates.push('atualizado_em = now()');

  await getPool().query(
    `insert into public.vitrine_produtos (${colunas.join(', ')})
     values (${placeholders.join(', ')})
     on conflict (sku) do update set ${updates.join(', ')}`,
    vals
  );
}

export async function limparProduto(sku) {
  await getPool().query('delete from public.vitrine_produtos where sku = $1', [String(sku)]);
}

/* ── Imagens ──────────────────────────────────────────────────── */

export async function salvarImagem(alvo, mime, base64) {
  if (!MIMES.has(mime)) throw new Error('Formato não aceito. Use JPG, PNG, WebP ou AVIF.');
  const bytes = Buffer.from(String(base64 || '').split(',').pop() || '', 'base64');
  if (!bytes.length) throw new Error('Arquivo vazio.');
  if (bytes.length > MAX_IMAGEM) throw new Error('Imagem acima de 2 MB. Reduza antes de enviar.');

  if (alvo === 'destaque') {
    await getPool().query(
      `update public.vitrine_destaque
          set imagem_mime = $1, imagem_bytes = $2, atualizado_em = now() where id = 1`,
      [mime, bytes]
    );
  } else {
    await getPool().query(
      `insert into public.vitrine_produtos (sku, imagem_mime, imagem_bytes)
       values ($1, $2, $3)
       on conflict (sku) do update
         set imagem_mime = $2, imagem_bytes = $3, atualizado_em = now()`,
      [String(alvo), mime, bytes]
    );
  }
  return { ok: true, bytes: bytes.length };
}

export async function removerImagem(alvo) {
  if (alvo === 'destaque') {
    await getPool().query(
      `update public.vitrine_destaque
          set imagem_mime = null, imagem_bytes = null, atualizado_em = now() where id = 1`
    );
  } else {
    await getPool().query(
      `update public.vitrine_produtos
          set imagem_mime = null, imagem_bytes = null, atualizado_em = now() where sku = $1`,
      [String(alvo)]
    );
  }
}

export async function lerImagem(alvo) {
  const sql =
    alvo === 'destaque'
      ? 'select imagem_mime as mime, imagem_bytes as bytes from public.vitrine_destaque where id = 1'
      : 'select imagem_mime as mime, imagem_bytes as bytes from public.vitrine_produtos where sku = $1';
  const { rows } = await getPool().query(sql, alvo === 'destaque' ? [] : [String(alvo)]);
  const r = rows[0];
  if (!r || !r.bytes) return null;
  return { mime: r.mime || 'image/jpeg', bytes: r.bytes };
}

function normalizarTexto(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export default {
  lerDestaque,
  salvarDestaque,
  lerOverrides,
  aplicarOverrides,
  salvarProduto,
  limparProduto,
  salvarImagem,
  removerImagem,
  lerImagem,
  urlImagem,
};
