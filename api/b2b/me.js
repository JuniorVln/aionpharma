/* ================================================================
   GET  /api/b2b/me — dados da conta logada (revalida a sessão)
   PATCH /api/b2b/me — o lojista atualiza contato/endereço padrão
   ================================================================ */

import { getSupabaseAdmin } from '../_lib/supabase.js';
import { CAMPOS_PUBLICOS, contaDaRequisicao, contaPublica } from '../_lib/b2b.js';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const conta = await contaDaRequisicao(req);
  if (!conta) return res.status(401).json({ error: 'Sessão expirada. Entre de novo.' });

  if (req.method === 'GET') {
    return res.status(200).json({ conta: contaPublica(conta) });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readJson(req);
    // Nível, CNPJ e status só mudam pelo admin — nunca pelo próprio lojista.
    const campos = {
      telefone: body.telefone,
      contato_nome: body.contatoNome,
      cep: body.cep ? String(body.cep).replace(/\D/g, '') : undefined,
      endereco: body.endereco,
      numero: body.numero,
      complemento: body.complemento,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf ? String(body.uf).toUpperCase().slice(0, 2) : undefined,
    };
    const update = Object.fromEntries(
      Object.entries(campos)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
    );
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('b2b_accounts')
      .update(update)
      .eq('id', conta.id)
      .select(CAMPOS_PUBLICOS)
      .single();
    if (error) throw new Error(`Supabase b2b_accounts: ${error.message}`);

    return res.status(200).json({ conta: contaPublica(data) });
  } catch (err) {
    console.error('[/api/b2b/me]', err.message);
    return res.status(502).json({ error: 'Falha ao atualizar a conta', detail: err.message });
  }
}
