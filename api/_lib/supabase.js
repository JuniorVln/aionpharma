/* ================================================================
   Cliente Supabase — service role (APIs) e helper de auth
   ================================================================ */

import { createClient } from '@supabase/supabase-js';

let adminClient = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.');
  }
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** Valida o Bearer JWT do Supabase Auth. Retorna o user ou null. */
export async function getAuthUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function requireAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }
  return user;
}

export default { getSupabaseAdmin, getAuthUser, requireAdmin };
