/* ================================================================
   Autenticação do painel — própria, sem Supabase Auth.

   As senhas continuam sendo as mesmas: vieram do Supabase em bcrypt
   e são conferidas aqui com bcryptjs. Ninguém precisa trocar senha.

   O token é assinado com HMAC-SHA256 (ADMIN_JWT_SECRET) no formato
   JWT, então o front continua mandando "Authorization: Bearer <token>".
   ================================================================ */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const VALIDADE_HORAS = 12;

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const doB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function segredo() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET não configurado.');
  return s;
}

function assinar(dados) {
  return b64url(crypto.createHmac('sha256', segredo()).update(dados).digest());
}

export function emitirToken(user) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const agora = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: user.id,
    email: user.email,
    iat: agora,
    exp: agora + VALIDADE_HORAS * 3600,
  }));
  const corpo = header + '.' + payload;
  return corpo + '.' + assinar(corpo);
}

/** Confere a assinatura e a validade. Devolve o payload ou null. */
export function lerToken(token) {
  try {
    const partes = String(token || '').split('.');
    if (partes.length !== 3) return null;
    const corpo = partes[0] + '.' + partes[1];
    const esperada = assinar(corpo);
    const a = Buffer.from(esperada);
    const b = Buffer.from(partes[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(doB64url(partes[1]).toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Confere e-mail + senha contra auth.users. Devolve o usuário ou null. */
export async function autenticar(email, senha) {
  if (!email || !senha) return null;
  const { rows } = await (await import('./db.js')).getPool().query(
    'select id, email, encrypted_password, email_confirmed_at from auth.users where lower(email) = lower($1) limit 1',
    [String(email).trim()]
  );
  const u = rows[0];
  if (!u || !u.encrypted_password) return null;
  if (!u.email_confirmed_at) return null;
  const ok = await bcrypt.compare(String(senha), u.encrypted_password);
  if (!ok) return null;
  return { id: u.id, email: u.email };
}

/** Lê o Bearer da requisição. Devolve o usuário do token ou null. */
export function getAuthUser(req) {
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const p = lerToken(token);
  return p ? { id: p.sub, email: p.email } : null;
}

/** Igual ao que existia antes: responde 401 e devolve null se não autenticado. */
export async function requireAdmin(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }
  return user;
}

export default { emitirToken, lerToken, autenticar, getAuthUser, requireAdmin, getDb };
