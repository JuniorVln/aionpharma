/* ================================================================
   POST /api/b2b/pf-cadastro — cria a conta do cliente pessoa física
   Fluxo: CPF com dígito válido + e-mail + senha → conta ativa na hora
   e já logada. Diferente do B2B, não há aprovação manual: PF compra
   pela tabela Cliente Final, a mesma de quem compra sem conta, então
   liberar o acesso não dá desconto nenhum.
   ================================================================ */

import { getDb } from '../db.js';
import {
  assinarToken,
  camposEditaveis,
  contaPfPublica,
  emailValido,
  hashSenha,
  normalizarCpf,
  normalizarEmail,
  readJson,
  senhaFraca,
  validarCpf,
} from '../pf.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readJson(req);
    const cpf = normalizarCpf(body.cpf);
    const email = normalizarEmail(body.email);
    const nome = String(body.nome || '').trim();
    const senha = String(body.senha || '');

    if (!nome || nome.length < 3) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }
    if (!validarCpf(cpf)) {
      return res.status(400).json({ error: 'CPF inválido. Confira os números e tente de novo.' });
    }
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    const problemaSenha = senhaFraca(senha);
    if (problemaSenha) {
      return res.status(400).json({ error: problemaSenha });
    }

    const db = getDb();
    const [porCpf, porEmail] = await Promise.all([
      db.from('pf_accounts').select('id').eq('cpf', cpf).maybeSingle(),
      db.from('pf_accounts').select('id').eq('email', email).maybeSingle(),
    ]);
    if (porCpf.error) throw new Error(`pf_accounts: ${porCpf.error.message}`);
    if (porEmail.error) throw new Error(`pf_accounts: ${porEmail.error.message}`);
    if (porCpf.data || porEmail.data) {
      const qual = porCpf.data ? 'CPF' : 'e-mail';
      return res.status(409).json({
        error: `Já existe uma conta com esse ${qual}. Entre com sua senha ou fale com a gente pelo WhatsApp.`,
      });
    }

    const registro = {
      cpf,
      nome,
      email,
      senha_hash: hashSenha(senha),
      ativo: true,
      ...camposEditaveis({ ...body, nome: undefined }),
    };

    const { data: conta, error } = await db
      .from('pf_accounts')
      .insert(registro)
      .select('*')
      .single();
    if (error) throw new Error(`pf_accounts: ${error.message}`);

    const token = assinarToken({ sub: conta.id, tipo: 'pf' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ token, conta: contaPfPublica(conta) });
  } catch (err) {
    console.error('[/api/b2b/pf-cadastro]', err.message);
    return res.status(502).json({ error: 'Falha ao criar a conta', detail: err.message });
  }
}
