/* ================================================================
   /api/b2b/:acao — cadastro | login | me
   Uma única função serverless (limite de 12 no plano Hobby da
   Vercel); os handlers reais moram em api/_lib/b2b-rotas/.
   ================================================================ */

import cadastro from '../_lib/b2b-rotas/cadastro.js';
import login from '../_lib/b2b-rotas/login.js';
import me from '../_lib/b2b-rotas/me.js';

const ROTAS = { cadastro, login, me };

export default async function handler(req, res) {
  const acao = String(req.query?.acao || '').toLowerCase();
  const rota = ROTAS[acao];
  if (!rota) return res.status(404).json({ error: 'Rota não encontrada' });
  return rota(req, res);
}
