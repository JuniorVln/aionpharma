/* ================================================================
   POST /api/webhook
   Recebe as notificações do Mercado Pago. Quando um pagamento é
   aprovado, atualiza a situação do pedido no Tiny e (opcionalmente)
   dispara a emissão da NF-e.
   ----------------------------------------------------------------
   O MP envia o id do pagamento; buscamos os detalhes na API do MP,
   pegamos o external_reference (= id do pedido no Tiny) e atualizamos.
   ================================================================ */

import { obterPagamento } from './_lib/mercadopago.js';
import { alterarSituacaoPedido, gerarNotaFiscal } from './_lib/tiny.js';

export default async function handler(req, res) {
  // Responda 200 rápido — o MP reenvia se não receber 200.
  if (req.method !== 'POST') {
    return res.status(200).end();
  }

  try {
    const type = req.query?.type || req.body?.type;
    const paymentId = req.query?.['data.id'] || req.body?.data?.id;

    // Só tratamos eventos de pagamento
    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ ignored: true });
    }

    const pagamento = await obterPagamento(paymentId);
    const pedidoId = pagamento.external_reference;
    const status = pagamento.status; // approved, pending, rejected, ...

    if (!pedidoId) {
      return res.status(200).json({ ignored: 'sem external_reference' });
    }

    if (status === 'approved') {
      await alterarSituacaoPedido(pedidoId, 'aprovado');

      if (String(process.env.AUTO_EMIT_NFE).toLowerCase() === 'true') {
        try {
          await gerarNotaFiscal(pedidoId);
        } catch (nfErr) {
          // Não falha o webhook por causa da NF — apenas registra.
          console.error('[/api/webhook] NF-e:', nfErr.message);
        }
      }
    } else if (status === 'cancelled' || status === 'rejected') {
      await alterarSituacaoPedido(pedidoId, 'cancelado');
    }

    return res.status(200).json({ ok: true, pedidoId, status });
  } catch (err) {
    console.error('[/api/webhook]', err.message);
    // Mesmo em erro, devolvemos 200 para evitar tempestade de reenvios;
    // o erro fica logado para investigação.
    return res.status(200).json({ ok: false, error: err.message });
  }
}
