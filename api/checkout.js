/* ================================================================
   POST /api/checkout
   1. Valida cupom (se houver) e aplica desconto nos itens
   2. Cria o pedido no Tiny (situação "aberto")
   3. Cria a preferência de pagamento no Mercado Pago
   4. Guarda vínculo pedido↔cupom para o webhook registrar o uso
   ================================================================ */

import { incluirPedido, montarPedido } from './_lib/tiny.js';
import { criarPreferencia } from './_lib/mercadopago.js';
import {
  buscarCupomValido,
  calcularDesconto,
  aplicarDescontoNosItens,
  salvarCheckoutCupom,
} from './_lib/cupons.js';

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
    const { cliente, itens, frete, cupom: cupomCodigo } = await readJson(req);

    if (!cliente?.nome || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Pedido inválido: informe cliente e itens.' });
    }

    const valorFrete = frete && Number(frete.price) > 0 ? Number(frete.price) : 0;
    const subtotalOriginal = itens.reduce(
      (s, it) => s + Number(it.price) * Number(it.qty),
      0
    );

    let cupomInfo = null;
    let itensFinais = itens;
    let valorDesconto = 0;
    let obsCupom = '';

    if (cupomCodigo) {
      const result = await buscarCupomValido(cupomCodigo);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      cupomInfo = result.coupon;
      const calc = calcularDesconto(subtotalOriginal, cupomInfo.desconto_percent);
      valorDesconto = calc.valorDesconto;
      itensFinais = aplicarDescontoNosItens(itens, cupomInfo.desconto_percent);
      obsCupom = `Cupom ${cupomInfo.codigo} (${cupomInfo.desconto_percent}%): -R$ ${valorDesconto.toFixed(2)}.`;
    }

    const pedido = montarPedido({
      cliente,
      itens: itensFinais,
      frete,
      observacoes: [
        'Pedido originado pela loja online (aguardando pagamento).',
        obsCupom,
      ]
        .filter(Boolean)
        .join(' '),
      situacao: 'aberto',
    });
    const { id: pedidoId, numero } = await incluirPedido(pedido);

    const preferencia = await criarPreferencia({
      externalReference: String(pedidoId),
      items: itensFinais.map((it) => ({
        title: it.name,
        quantity: it.qty,
        unit_price: it.price,
        picture_url: it.image || undefined,
      })),
      shipmentCost: valorFrete,
      payer: cliente.email ? { name: cliente.nome, email: cliente.email } : undefined,
    });

    if (cupomInfo) {
      try {
        await salvarCheckoutCupom({
          pedidoId,
          pedidoNumero: numero,
          couponId: cupomInfo.id,
          codigo: cupomInfo.codigo,
          emailCliente: cliente.email,
          valorPedido: Math.round((subtotalOriginal - valorDesconto + valorFrete) * 100) / 100,
          valorDesconto,
        });
      } catch (cupomErr) {
        // Pedido já criado — não bloqueia o pagamento; loga para investigação.
        console.error('[/api/checkout] salvarCheckoutCupom:', cupomErr.message);
      }
    }

    const isProd = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').startsWith('APP_USR');
    const paymentUrl = isProd ? preferencia.init_point : preferencia.sandbox_init_point;

    return res.status(200).json({
      pedidoId,
      numero,
      preferenceId: preferencia.id,
      paymentUrl,
      publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || null,
      cupom: cupomInfo
        ? {
            codigo: cupomInfo.codigo,
            desconto_percent: cupomInfo.desconto_percent,
            valor_desconto: valorDesconto,
          }
        : null,
    });
  } catch (err) {
    console.error('[/api/checkout]', err.message);
    return res.status(502).json({ error: 'Falha ao processar o checkout', detail: err.message });
  }
}
