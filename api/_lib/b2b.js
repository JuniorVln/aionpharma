/* ================================================================
   Contas B2B (compra com CNPJ) — validação, senha, sessão e preço
   ----------------------------------------------------------------
   As contas B2B NÃO usam o Supabase Auth: aquele login é do painel
   /admin e suas policies liberam tudo para qualquer `authenticated`.
   Um lojista logado ali enxergaria cupons e influencers. Por isso a
   sessão do lojista é um JWT HS256 próprio (segredo B2B_JWT_SECRET)
   e a senha fica como scrypt na tabela b2b_accounts.
   ================================================================ */

import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabase.js';

/* ── Listas de preço da Olist/Tiny ──────────────────────────────
   Conta Aion: 321 = Cliente Final (vitrine B2C), 103 = Lojista,
   102 = Distribuição. A conta guarda o NÍVEL e o id da lista vem de
   env — se o sócio recriar a tabela na Olist, muda só a variável. */
export const NIVEIS = ['lojista', 'distribuicao'];

export function idListaPrecoB2C() {
  return process.env.TINY_ID_LISTA_PRECO || '321';
}

export function idListaPrecoDoNivel(nivel) {
  if (nivel === 'distribuicao') return process.env.TINY_ID_LISTA_PRECO_DISTRIBUICAO || '102';
  return process.env.TINY_ID_LISTA_PRECO_LOJISTA || '103';
}

export function rotuloDoNivel(nivel) {
  return nivel === 'distribuicao' ? 'Distribuição' : 'Lojista';
}

/* ── CNPJ ───────────────────────────────────────────────────────
   Aceita o CNPJ numérico e o alfanumérico (cada caractere vale
   charCode - 48, conforme a regra da Receita). */
export function normalizarCnpj(valor) {
  return String(valor || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
}

export function formatarCnpj(cnpj) {
  const c = normalizarCnpj(cnpj);
  if (c.length !== 14) return c;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function validarCnpj(valor) {
  const cnpj = normalizarCnpj(valor);
  if (cnpj.length !== 14) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;              // 00000000000000 e afins
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;  // os 2 DVs são sempre numéricos

  const val = (i) => cnpj.charCodeAt(i) - 48;
  const dv = (tamanho) => {
    let peso = 2;
    let soma = 0;
    for (let i = tamanho - 1; i >= 0; i--) {
      soma += val(i) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(12) === val(12) && dv(13) === val(13);
}

/**
 * Consulta pública de CNPJ (BrasilAPI). É best-effort: serve para
 * puxar a razão social e barrar CNPJ que só é válido no dígito. Se a
 * consulta falhar ou estourar o tempo, o cadastro segue com o que o
 * lojista digitou — não travamos venda por causa de API de terceiro.
 */
export async function consultarCnpj(cnpj) {
  const numero = normalizarCnpj(cnpj);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/v1/cnpj/v1/${numero}`, { signal: ctrl.signal });
    if (r.status === 404) return { ok: false, encontrado: false };
    if (!r.ok) return { ok: false, indisponivel: true };
    const d = await r.json();
    return {
      ok: true,
      encontrado: true,
      razaoSocial: d.razao_social || '',
      nomeFantasia: d.nome_fantasia || '',
      situacao: d.descricao_situacao_cadastral || '',
      uf: d.uf || '',
      municipio: d.municipio || '',
    };
  } catch {
    return { ok: false, indisponivel: true };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Senha (scrypt, sem dependência externa) ───────────────────── */
export function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(String(senha), salt, 64);
  return `scrypt$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verificarSenha(senha, hash) {
  const [alg, saltB64, dkB64] = String(hash || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !dkB64) return false;
  const esperado = Buffer.from(dkB64, 'base64');
  const dk = crypto.scryptSync(String(senha), Buffer.from(saltB64, 'base64'), esperado.length);
  return crypto.timingSafeEqual(dk, esperado);
}

/* ── Sessão (JWT HS256 próprio) ────────────────────────────────── */
const TTL_PADRAO = 60 * 60 * 24 * 30; // 30 dias

function segredo() {
  const s = process.env.B2B_JWT_SECRET;
  if (!s || s.length < 24) {
    throw new Error('B2B_JWT_SECRET não configurado (mínimo 24 caracteres).');
  }
  return s;
}

const b64 = (v) => Buffer.from(v).toString('base64url');

export function assinarToken(payload, ttl = TTL_PADRAO) {
  const agora = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ ...payload, iat: agora, exp: agora + ttl }));
  const sig = crypto.createHmac('sha256', segredo()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verificarToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  const [head, body, sig] = partes;
  const esperada = crypto.createHmac('sha256', segredo()).update(`${head}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── Conta ──────────────────────────────────────────────────────── */
export const CAMPOS_PUBLICOS =
  'id, cnpj, razao_social, nome_fantasia, email, telefone, contato_nome, nivel, ativo, cep, endereco, numero, complemento, bairro, cidade, uf, created_at, ultimo_login';

/** Formato devolvido ao navegador (nunca inclui hash de senha). */
export function contaPublica(conta) {
  if (!conta) return null;
  return {
    id: conta.id,
    cnpj: formatarCnpj(conta.cnpj),
    razaoSocial: conta.razao_social,
    nomeFantasia: conta.nome_fantasia || '',
    email: conta.email,
    telefone: conta.telefone || '',
    contatoNome: conta.contato_nome || '',
    nivel: conta.nivel,
    nivelLabel: rotuloDoNivel(conta.nivel),
    endereco: {
      cep: conta.cep || '',
      logradouro: conta.endereco || '',
      numero: conta.numero || '',
      complemento: conta.complemento || '',
      bairro: conta.bairro || '',
      cidade: conta.cidade || '',
      uf: conta.uf || '',
    },
  };
}

/**
 * Lê o Bearer da requisição e devolve a conta B2B ativa, ou null.
 * Nunca lança: rota pública (ex.: /api/produtos) chama isso a cada
 * request e token inválido só significa "visitante B2C".
 */
export async function contaDaRequisicao(req) {
  try {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const token = String(header).replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const payload = verificarToken(token);
    if (!payload?.sub) return null;

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('b2b_accounts')
      .select(CAMPOS_PUBLICOS)
      .eq('id', payload.sub)
      .maybeSingle();
    if (error || !data || !data.ativo) return null;
    return data;
  } catch {
    return null;
  }
}

export default {
  NIVEIS,
  idListaPrecoB2C,
  idListaPrecoDoNivel,
  rotuloDoNivel,
  normalizarCnpj,
  formatarCnpj,
  validarCnpj,
  consultarCnpj,
  hashSenha,
  verificarSenha,
  assinarToken,
  verificarToken,
  contaPublica,
  contaDaRequisicao,
};
