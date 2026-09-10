/* ================================================================
   POST /api/b2b/pf-login — sessão do cliente PF (CPF ou e-mail + senha)
   5 senhas erradas → conta bloqueada por 15 minutos.
   ================================================================ */

import { getDb } from '../db.js';
import {
  assinarToken,
  contaPfPublica,
  normalizarCpf,
  normalizarEmail,
  readJson,
  verificarSenha,
} from '../pf.js';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { identificador, senha } = await readJson(req);
    const bruto = String(identificador || '').trim();
    if (!bruto || !senha) {
      return res.status(400).json({ error: 'Informe CPF (ou e-mail) e senha.' });
    }

    const db = getDb();
    const ehEmail = bruto.includes('@');
    const filtro = ehEmail
      ? { coluna: 'email', valor: normalizarEmail(bruto) }
      : { coluna: 'cpf', valor: normalizarCpf(bruto) };

    const { data: conta, error } = await db
      .from('pf_accounts')
      .select('*')
      .eq(filtro.coluna, filtro.valor)
      .maybeSingle();
    if (error) throw new Error(`pf_accounts: ${error.message}`);

    // Mensagem genérica: não revela se o CPF existe na base.
    const generico = { error: 'CPF/e-mail ou senha incorretos.' };
    if (!conta) return res.status(401).json(generico);

    if (conta.bloqueado_ate && new Date(conta.bloqueado_ate).getTime() > Date.now()) {
      return res.status(429).json({
        error: 'Muitas tentativas. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.',
      });
    }

    if (!verificarSenha(senha, conta.senha_hash)) {
      const tentativas = Number(conta.tentativas_falhas || 0) + 1;
      const bloqueio =
        tentativas >= MAX_TENTATIVAS
          ? new Date(Date.now() + BLOQUEIO_MIN * 60 * 1000).toISOString()
          : null;
      await db
        .from('pf_accounts')
        .update({ tentativas_falhas: bloqueio ? 0 : tentativas, bloqueado_ate: bloqueio })
        .eq('id', conta.id);
      return res.status(401).json(generico);
    }

    if (!conta.ativo) {
      return res.status(403).json({
        error: 'Esta conta está desativada. Fale com a gente pelo WhatsApp.',
      });
    }

    await db
      .from('pf_accounts')
      .update({
        tentativas_falhas: 0,
        bloqueado_ate: null,
        ultimo_login: new Date().toISOString(),
      })
      .eq('id', conta.id);

    const token = assinarToken({ sub: conta.id, tipo: 'pf' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token, conta: contaPfPublica(conta) });
  } catch (err) {
    console.error('[/api/b2b/pf-login]', err.message);
    return res.status(502).json({ error: 'Falha ao entrar', detail: err.message });
  }
}
