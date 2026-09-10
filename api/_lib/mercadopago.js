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

/* ----------------------------------------------------------------
   Qual conta está por trás do token?
   ATENÇÃO: `APP_USR-` NÃO quer dizer produção. Usuário de teste do
   Mercado Pago também recebe token `APP_USR-`. A única checagem que
   vale é perguntar pro próprio MP quem é o dono da credencial:
   se `tags` inclui `test_user`, o dinheiro NÃO chega na conta real e
   qualquer comprador de verdade leva "uma das partes é de teste".
   Resultado fica em cache no processo (a credencial não muda em
   tempo de execução).
   ---------------------------------------------------------------- */
let _contaCache = null;

export async function contaDaCredencial() {
  if (_contaCache) return _contaCache;
  try {
    const res = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return { conhecida: false, ehTeste: null, motivo: data?.message || `HTTP ${res.status}` };
    }
    const tags = Array.isArray(data.tags) ? data.tags : [];
    _contaCache = {
      conhecida: true,
      ehTeste: tags.includes('test_user'),
      id: data.id,
      nickname: data.nickname,
      email: data.email,
    };
    if (_contaCache.ehTeste) {
      console.error(
        `[mercadopago] ALERTA: a credencial em uso e de CONTA DE TESTE (${_contaCache.nickname}). ` +
        `Nenhum pagamento real entra na conta da Aion e todo cliente de verdade recebe ` +
        `"uma das partes e de teste". Trocar MERCADOPAGO_ACCESS_TOKEN pelo Access Token de ` +
        `producao da conta real.`
      );
    }
    return _contaCache;
  } catch (err) {
    return { conhecida: false, ehTeste: null, motivo: err.message };
  }
}

/**
 * Cria uma preferência de pagamento (Checkout Pro).
 * @param {object} opts
 * @param {Array<{title,quantity,unit_price,picture_url?}>} opts.items
 * @param {string} opts.externalReference  id do pedido no Tiny (para conciliar)
 * @param {number} [opts.shipmentCost]      valor do frete (somado ao total)
 * @param {object} [opts.payer]
 * @returns {Promise<{ id, init_point, sandbox_init_point }>}
 */
export async function criarPreferencia({ items, externalReference, shipmentCost = 0, payer }) {
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

  const preference = {
    items: items.map((it) => ({
      title: it.title,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      currency_id: 'BRL',
      picture_url: it.picture_url || undefined,
    })),
    shipments: Number(shipmentCost) > 0
      ? { cost: Number(shipmentCost), mode: 'not_specified' }
      : undefined,
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

export default { criarPreferencia, obterPagamento, contaDaCredencial };
