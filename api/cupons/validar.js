/* POST /api/cupons/validar — público */

import { buscarCupomValido } from '../_lib/cupons.js';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { codigo } = await readJson(req);
    const result = await buscarCupomValido(codigo);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.status(200).json({
      ok: true,
      codigo: result.coupon.codigo,
      desconto_percent: result.coupon.desconto_percent,
      influencer: result.coupon.influencer,
    });
  } catch (err) {
    console.error('[/api/cupons/validar]', err.message);
    return res.status(502).json({ ok: false, error: 'Falha ao validar cupom', detail: err.message });
  }
}
