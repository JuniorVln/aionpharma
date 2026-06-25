/* ================================================================
   Cliente Mercado Pago — Checkout Pro (preferências de pagamento)
   Docs: https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
   ----------------------------------------------------------------
   Fluxo: criamos uma "preferência" com os itens do carrinho e o MP
   devolve uma URL (init_point) para a qual redirecionamos o cliente.
   Após o pagamento, o MP chama nosso webhook e redireciona o cliente
   de volta para as back_urls.
   ================================================================ */

const BASE_URL = 'https://api.mercadopago.com';

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.');
  }
  return token;
}

/**
 * Cria uma preferência de pagamento (Checkout Pro).
 * @param {object} opts
 * @param {Array<{title,quantity,unit_price,picture_url?}>} opts.items
 * @param {string} opts.externalReference  id do pedido no Tiny (para conciliar)
 * @param {object} [opts.payer]
 * @returns {Promise<{ id, init_point, sandbox_init_point }>}
 */
export async function criarPreferencia({ items, externalReference, payer }) {
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

  const preference = {
    items: items.map((it) => ({
      title: it.title,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      currency_id: 'BRL',
      picture_url: it.picture_url || undefined,
    })),
    external_reference: externalReference,
    payer: payer || undefined,
    back_urls: {
      success: `${siteUrl}/pedido-confirmado?status=sucesso`,
      pending: `${siteUrl}/pedido-confirmado?status=pendente`,
      failure: `${siteUrl}/pedido-confirmado?status=falha`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/webhook`,
    statement_descriptor: 'AION PHARMA',
  };

  const res = await fetch(`${BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(preference),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Mercado Pago preferência: ${data?.message || res.status}`);
  }
  return data;
}

/** Busca os detalhes de um pagamento (usado no webhook). */
export async function obterPagamento(paymentId) {
  const res = await fetch(`${BASE_URL}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Mercado Pago pagamento ${paymentId}: ${data?.message || res.status}`);
  }
  return data;
}

export default { criarPreferencia, obterPagamento };
