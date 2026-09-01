/* ================================================================
   POST /api/b2b/login — sessão do lojista (CNPJ ou e-mail + senha)
   5 senhas erradas → conta bloqueada por 15 minutos.
   ================================================================ */

import { getSupabaseAdmin } from '../_lib/supabase.js';
import {
  assinarToken,
  contaPublica,
  normalizarCnpj,
  verificarSenha,
} from '../_lib/b2b.js';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { identificador, senha } = await readJson(req);
    const bruto = String(identificador || '').trim();
    if (!bruto || !senha) {
      return res.status(400).json({ error: 'Informe CNPJ (ou e-mail) e senha.' });
    }

    const sb = getSupabaseAdmin();
    const ehEmail = bruto.includes('@');
    const filtro = ehEmail
      ? { coluna: 'email', valor: bruto.toLowerCase() }
      : { coluna: 'cnpj', valor: normalizarCnpj(bruto) };

    const { data: conta, error } = await sb
      .from('b2b_accounts')
      .select('*')
      .eq(filtro.coluna, filtro.valor)
      .maybeSingle();
    if (error) throw new Error(`Supabase b2b_accounts: ${error.message}`);

    // Mensagem genérica: não revela se o CNPJ existe na base.
    const generico = { error: 'CNPJ/e-mail ou senha incorretos.' };
    if (!conta) return res.status(401).json(generico);

    if (conta.bloqueado_ate && new Date(conta.bloqueado_ate).getTime() > Date.now()) {
      return res.status(429).json({
        error: `Muitas tentativas. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.`,
      });
    }

    if (!verificarSenha(senha, conta.senha_hash)) {
      const tentativas = Number(conta.tentativas_falhas || 0) + 1;
      const bloqueio =
        tentativas >= MAX_TENTATIVAS
          ? new Date(Date.now() + BLOQUEIO_MIN * 60 * 1000).toISOString()
          : null;
      await sb
        .from('b2b_accounts')
        .update({
          tentativas_falhas: bloqueio ? 0 : tentativas,
          bloqueado_ate: bloqueio,
        })
        .eq('id', conta.id);
      return res.status(401).json(generico);
    }

    if (!conta.ativo) {
      return res.status(403).json({
        error: 'Conta desativada. Fale com o comercial da Aion para reativar.',
      });
    }

    await sb
      .from('b2b_accounts')
      .update({
        tentativas_falhas: 0,
        bloqueado_ate: null,
        ultimo_login: new Date().toISOString(),
      })
      .eq('id', conta.id);

    const token = assinarToken({ sub: conta.id, cnpj: conta.cnpj, nivel: conta.nivel });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token, conta: contaPublica(conta) });
  } catch (err) {
    console.error('[/api/b2b/login]', err.message);
    return res.status(502).json({ error: 'Falha ao entrar', detail: err.message });
  }
}
