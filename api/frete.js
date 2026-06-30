/* ================================================================
   POST /api/frete
   Cota o frete (Melhor Envio) para um CEP de destino + itens do
   carrinho. O frontend chama este endpoint quando o cliente digita
   o CEP no checkout, mostra as opções (PAC/Sedex/...) e o cliente
   escolhe uma — que depois vai junto no /api/checkout.
   ----------------------------------------------------------------
   Body (JSON): { "cep": "20000-000", "itens": [{ id, name, price, qty }] }
   Resposta:    { "opcoes": [{ id, name, company, price, prazo, ... }],
                  "freteGratis": boolean }
   ================================================================ */

import { cotarFrete } from './_lib/melhorenvio.js';

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
    const { cep, itens } = await readJson(req);

    if (!cep || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Informe o CEP e os itens do carrinho.' });
    }

    const opcoes = await cotarFrete({ cepDestino: cep, itens });

    // Frete grátis acima do limite (FREE_SHIPPING_THRESHOLD). 0 = desativado.
    const limite = Number(process.env.FREE_SHIPPING_THRESHOLD || 0);
    const subtotal = itens.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
    const freteGratis = limite > 0 && subtotal >= limite;

    if (!opcoes.length) {
      return res.status(200).json({ opcoes: [], freteGratis, aviso: 'Nenhuma transportadora disponível para este CEP.' });
    }

    return res.status(200).json({ opcoes, freteGratis });
  } catch (err) {
    console.error('[/api/frete]', err.message);
    return res.status(502).json({ error: 'Falha ao calcular o frete', detail: err.message });
  }
}
