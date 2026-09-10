/* ================================================================
   /api/b2b/:acao — contas da loja, numa função só
   ----------------------------------------------------------------
   Lojista (CNPJ):  cadastro | login | me
   Cliente (CPF):   pf-cadastro | pf-login | pf-me | pf-pedidos

   Por que PF mora aqui e não em /api/conta: o plano Hobby da Vercel
   permite no máximo 12 funções em /api e já existem 11. Cada arquivo
   novo em /api viraria a 12ª e travaria o próximo recurso. Os
   handlers reais ficam em api/_lib/b2b-rotas e api/_lib/pf-rotas.
   ================================================================ */

import cadastro from '../_lib/b2b-rotas/cadastro.js';
import login from '../_lib/b2b-rotas/login.js';
import me from '../_lib/b2b-rotas/me.js';
import pfCadastro from '../_lib/pf-rotas/cadastro.js';
import pfLogin from '../_lib/pf-rotas/login.js';
import pfMe from '../_lib/pf-rotas/me.js';
import pfPedidos from '../_lib/pf-rotas/pedidos.js';

const ROTAS = {
  cadastro,
  login,
  me,
  'pf-cadastro': pfCadastro,
  'pf-login': pfLogin,
  'pf-me': pfMe,
  'pf-pedidos': pfPedidos,
};

export default async function handler(req, res) {
  const acao = String(req.query?.acao || '').toLowerCase();
  const rota = ROTAS[acao];
  if (!rota) return res.status(404).json({ error: 'Rota não encontrada' });
  return rota(req, res);
}
