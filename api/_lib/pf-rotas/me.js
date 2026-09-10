/* ================================================================
   GET   /api/b2b/pf-me — dados da conta PF logada (revalida a sessão)
   PATCH /api/b2b/pf-me — o cliente atualiza nome, contato e endereço
   ================================================================ */

import { getDb } from '../db.js';
import { CAMPOS_PUBLICOS, camposEditaveis, contaPfDaRequisicao, contaPfPublica, readJson } from '../pf.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const conta = await contaPfDaRequisicao(req);
  if (!conta) return res.status(401).json({ error: 'Sessão expirada. Entre de novo.' });

  if (req.method === 'GET') {
    return res.status(200).json({ conta: contaPfPublica(conta) });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readJson(req);
    // CPF, e-mail e status ficam de fora: mudam a identidade da conta e
    // o vínculo dos pedidos já emitidos na Olist.
    const update = camposEditaveis(body);
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    const db = getDb();
    const { data, error } = await db
      .from('pf_accounts')
      .update(update)
      .eq('id', conta.id)
      .select(CAMPOS_PUBLICOS)
      .single();
    if (error) throw new Error(`pf_accounts: ${error.message}`);

    return res.status(200).json({ conta: contaPfPublica(data) });
  } catch (err) {
    console.error('[/api/b2b/pf-me]', err.message);
    return res.status(502).json({ error: 'Falha ao atualizar a conta', detail: err.message });
  }
}
