/* GET/POST /api/admin/influencers */

import { getSupabaseAdmin, requireAdmin } from '../_lib/supabase.js';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const sb = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('influencers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ influencers: data || [] });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const nome = String(body.nome || '').trim();
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });

      const row = {
        nome,
        email: body.email ? String(body.email).trim() : null,
        instagram: body.instagram ? String(body.instagram).trim().replace(/^@/, '') : null,
        ativo: body.ativo !== false,
      };

      const { data, error } = await sb.from('influencers').insert(row).select().single();
      if (error) throw new Error(error.message);
      return res.status(201).json({ influencer: data });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const id = body.id;
      if (!id) return res.status(400).json({ error: 'id é obrigatório.' });

      const patch = {};
      if (body.nome !== undefined) patch.nome = String(body.nome).trim();
      if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
      if (body.instagram !== undefined) {
        patch.instagram = body.instagram
          ? String(body.instagram).trim().replace(/^@/, '')
          : null;
      }
      if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);

      const { data, error } = await sb
        .from('influencers')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ influencer: data });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('[/api/admin/influencers]', err.message);
    return res.status(502).json({ error: err.message });
  }
}
