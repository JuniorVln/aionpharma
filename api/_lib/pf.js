/* ================================================================
   Conta do cliente pessoa física (CPF)
   ----------------------------------------------------------------
   Reaproveita a criptografia e o JWT das contas B2B (mesmo segredo,
   mesmo formato), mas a sessão carrega `tipo: 'pf'`. As duas famílias
   nunca se confundem: `contaDaRequisicao` do b2b.js recusa token PF e
   `contaPfDaRequisicao` recusa token de lojista. Isso importa porque o
   nível B2B é o que escolhe a tabela de preço — uma sessão PF que
   passasse por lojista mostraria preço de custo ao consumidor.

   PF compra sempre na tabela Cliente Final; a conta existe para
   guardar endereço, acompanhar pedidos e evitar redigitação.
   ================================================================ */

import { getDb } from './db.js';
import { assinarToken, hashSenha, verificarSenha, verificarToken } from './b2b.js';

export { assinarToken, hashSenha, verificarSenha, verificarToken };

/* ── CPF ────────────────────────────────────────────────────────── */

export function normalizarCpf(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

export function formatarCpf(cpf) {
  const c = normalizarCpf(cpf);
  if (c.length !== 11) return c;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

export function validarCpf(valor) {
  const cpf = normalizarCpf(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 000.000.000-00 e afins

  const dv = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/* ── E-mail e senha ─────────────────────────────────────────────── */

export function normalizarEmail(valor) {
  return String(valor || '').trim().toLowerCase();
}

export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizarEmail(valor));
}

export const SENHA_MINIMA = 8;

export function senhaFraca(senha) {
  const s = String(senha || '');
  if (s.length < SENHA_MINIMA) return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  if (/^\d+$/.test(s)) return 'A senha não pode ser só números.';
  return null;
}

/* ── Conta ──────────────────────────────────────────────────────── */

export const CAMPOS_PUBLICOS =
  'id, cpf, nome, email, telefone, ativo, cep, endereco, numero, complemento, bairro, cidade, uf, created_at, ultimo_login';

/** Formato devolvido ao navegador (nunca inclui hash de senha). */
export function contaPfPublica(conta) {
  if (!conta) return null;
  return {
    id: conta.id,
    cpf: formatarCpf(conta.cpf),
    nome: conta.nome,
    email: conta.email,
    telefone: conta.telefone || '',
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
 * Lê o Bearer da requisição e devolve a conta PF ativa, ou null.
 * Nunca lança: o checkout chama isso em toda compra e token inválido
 * só significa "visitante sem conta".
 */
export async function contaPfDaRequisicao(req) {
  try {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const token = String(header).replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const payload = verificarToken(token);
    if (!payload?.sub || payload.tipo !== 'pf') return null;

    const db = getDb();
    const { data, error } = await db
      .from('pf_accounts')
      .select(CAMPOS_PUBLICOS)
      .eq('id', payload.sub)
      .maybeSingle();
    if (error || !data || !data.ativo) return null;
    return data;
  } catch {
    return null;
  }
}

/** Campos de endereço/contato que o próprio cliente pode alterar. */
export function camposEditaveis(body) {
  const campos = {
    nome: body.nome,
    telefone: body.telefone,
    cep: body.cep ? String(body.cep).replace(/\D/g, '') : undefined,
    endereco: body.endereco,
    numero: body.numero,
    complemento: body.complemento,
    bairro: body.bairro,
    cidade: body.cidade,
    uf: body.uf ? String(body.uf).toUpperCase().slice(0, 2) : undefined,
  };
  return Object.fromEntries(
    Object.entries(campos)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
  );
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default {
  normalizarCpf,
  formatarCpf,
  validarCpf,
  normalizarEmail,
  emailValido,
  senhaFraca,
  contaPfPublica,
  contaPfDaRequisicao,
  camposEditaveis,
  readJson,
};
