/* ================================================================
   POST /api/checkout
   1. Cria o pedido no Tiny (situação "aberto")
   2. Cria a preferência de pagamento no Mercado Pago
   3. Devolve a URL de pagamento (init_point) para o frontend redirecionar
   ----------------------------------------------------------------
   Body esperado (JSON):
   {
     "cliente": { "nome", "email", "telefone", "cpfCnpj", "cep", ... },
     "itens": [ { "id", "sku", "name", "price", "qty", "image" } ]
   }
   ================================================================ */

import { incluirPedido, montarPedido } from './_lib/tiny.js';
import { criarPreferencia } from './_lib/mercadopago.js';

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
    const { cliente, itens } = await readJson(req);

    if (!cliente?.nome || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Pedido inválido: informe cliente e itens.' });
    }

    // 1) Cria o pedido no Tiny
    const pedido = montarPedido({
      cliente,
      itens,
      observacoes: 'Pedido originado pela loja online (aguardando pagamento).',
      situacao: 'aberto',
    });
    const { id: pedidoId, numero } = await incluirPedido(pedido);

    // 2) Cria a preferência de pagamento no Mercado Pago
    const preferencia = await criarPreferencia({
      externalReference: String(pedidoId),
      items: itens.map((it) => ({
        title: it.name,
        quantity: it.qty,
        unit_price: it.price,
        picture_url: it.image || undefined,
      })),
      payer: cliente.email ? { name: cliente.nome, email: cliente.email } : undefined,
    });

    // 3) Em produção usamos init_point; em testes, sandbox_init_point
    const isProd = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').startsWith('APP_USR');
    const paymentUrl = isProd ? preferencia.init_point : preferencia.sandbox_init_point;

    return res.status(200).json({
      pedidoId,
      numero,
      preferenceId: preferencia.id,
      paymentUrl,
    });
  } catch (err) {
    console.error('[/api/checkout]', err.message);
    return res.status(502).json({ error: 'Falha ao processar o checkout', detail: err.message });
  }
}
