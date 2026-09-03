/* ================================================================
   POST /api/b2b/cadastro — abre conta de compra com CNPJ
   Fluxo: CNPJ com dígito válido (e existente, quando a consulta
   pública responde) cria a conta como PENDENTE. O preço Lojista só
   passa a valer quando alguém da Aion ativa a conta no /admin, que
   também promove para Distribuição.
   ================================================================ */

import { getSupabaseAdmin } from '../_lib/supabase.js';
import {
  consultarCnpj,
  contaPublica,
  hashSenha,
  normalizarCnpj,
  validarCnpj,
  CAMPOS_PUBLICOS,
} from '../_lib/b2b.js';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readJson(req);
    const cnpj = normalizarCnpj(body.cnpj);
    const email = String(body.email || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    const razaoSocialInformada = String(body.razaoSocial || '').trim();

    if (!validarCnpj(cnpj)) {
      return res.status(400).json({ error: 'CNPJ inválido. Confira os números e tente de novo.' });
    }
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (senha.length < 8) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
    }

    // Duas consultas simples em vez de um `.or(...)`: e-mail é texto do
    // usuário e vírgula/parêntese quebram (ou torcem) o filtro do PostgREST.
    const sb = getSupabaseAdmin();
    const [porCnpj, porEmail] = await Promise.all([
      sb.from('b2b_accounts').select('id').eq('cnpj', cnpj).maybeSingle(),
      sb.from('b2b_accounts').select('id').eq('email', email).maybeSingle(),
    ]);
    if (porCnpj.error) throw new Error(`Supabase b2b_accounts: ${porCnpj.error.message}`);
    if (porEmail.error) throw new Error(`Supabase b2b_accounts: ${porEmail.error.message}`);
    if (porCnpj.data || porEmail.data) {
      const qual = porCnpj.data ? 'CNPJ' : 'e-mail';
      return res.status(409).json({ error: `Já existe uma conta com esse ${qual}. Faça login.` });
    }

    // Consulta pública: enriquece a razão social e barra CNPJ inexistente.
    // Se a API estiver fora, segue com o que o lojista digitou.
    const receita = await consultarCnpj(cnpj);
    if (receita.encontrado === false) {
      return res.status(400).json({ error: 'CNPJ não encontrado na base da Receita.' });
    }
    const razaoSocial = receita.razaoSocial || razaoSocialInformada;
    if (!razaoSocial) {
      return res.status(400).json({ error: 'Informe a razão social da empresa.' });
    }

    const { data: conta, error } = await sb
      .from('b2b_accounts')
      .insert({
        cnpj,
        razao_social: razaoSocial,
        nome_fantasia: receita.nomeFantasia || String(body.nomeFantasia || '').trim() || null,
        email,
        telefone: String(body.telefone || '').trim() || null,
        contato_nome: String(body.contatoNome || '').trim() || null,
        senha_hash: hashSenha(senha),
        nivel: 'lojista',
        // Nasce PENDENTE: o preço de lojista só vale depois que alguém da Aion
        // aprova a conta no /admin (pedido do Gabriel em 02/09/2026).
        ativo: false,
        cep: String(body.cep || '').replace(/\D/g, '') || null,
        endereco: String(body.endereco || '').trim() || null,
        numero: String(body.numero || '').trim() || null,
        complemento: String(body.complemento || '').trim() || null,
        bairro: String(body.bairro || '').trim() || null,
        cidade: String(body.cidade || '').trim() || receita.municipio || null,
        uf: (String(body.uf || '').trim() || receita.uf || '').toUpperCase().slice(0, 2) || null,
        cnpj_situacao: receita.situacao || (receita.indisponivel ? `nao verificado (${receita.motivo})` : null),
        cnpj_verificado: Boolean(receita.encontrado),
      })
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Já existe uma conta com esse CNPJ ou e-mail. Faça login.' });
      }
      throw new Error(`Supabase b2b_accounts: ${error.message}`);
    }

    // Sem token: a conta ainda não vale sessão nem preço B2B.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ pendente: true, conta: contaPublica(conta) });
  } catch (err) {
    console.error('[/api/b2b/cadastro]', err.message);
    return res.status(502).json({ error: 'Falha ao criar a conta', detail: err.message });
  }
}
