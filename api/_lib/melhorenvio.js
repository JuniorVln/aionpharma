/* ================================================================
   Cliente Melhor Envio — Cálculo de frete (cotação por CEP)
   Docs: https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos
   ----------------------------------------------------------------
   O Olist/Tiny NÃO expõe cotação de frete por API; a etiqueta é que
   sai pelo Olist Envios dentro do Tiny. Aqui usamos o Melhor Envio
   só para COTAR (PAC/Sedex/Jadlog...) por CEP no checkout do site.

   Env necessárias:
   - MELHORENVIO_TOKEN     → token Bearer (Sandbox ou Produção)
   - MELHORENVIO_SANDBOX   → "true" enquanto testa; "false"/ausente em produção
   - MELHORENVIO_FROM_CEP  → CEP de origem (de onde a loja despacha)
   - MELHORENVIO_USER_AGENT→ "Aion Pharma (email@dominio)" (exigido pela API)
   ================================================================ */

import { resolverEmbalagem } from './embalagem.js';

const PROD_URL = 'https://api.melhorenvio.com.br/api/v2/me/shipment/calculate';
const SANDBOX_URL = 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate';

function isSandbox() {
  return String(process.env.MELHORENVIO_SANDBOX).toLowerCase() === 'true';
}

function getConfig() {
  const token = process.env.MELHORENVIO_TOKEN;
  const fromCep = (process.env.MELHORENVIO_FROM_CEP || '').replace(/\D/g, '');
  if (!token) throw new Error('MELHORENVIO_TOKEN não configurado.');
  if (!fromCep) throw new Error('MELHORENVIO_FROM_CEP (CEP de origem) não configurado.');
  const userAgent = process.env.MELHORENVIO_USER_AGENT || 'Aion Pharma (marketing@tartoff.com.br)';
  return { token, fromCep, userAgent };
}

function isMock() {
  return String(process.env.MELHORENVIO_MOCK).toLowerCase() === 'true';
}

/** Peso total do carrinho (kg), usado no fallback e na simulação. */
function pesoTotal(itens) {
  return itens.reduce((s, it) => {
    const e = resolverEmbalagem(it);
    return s + e.weight * Math.max(1, Number(it.qty) || 1);
  }, 0);
}

/**
 * SIMULAÇÃO de cotação (modo `MELHORENVIO_MOCK=true`) — para testar o fluxo
 * sem o token real. Estimativa grosseira por peso; NÃO usar em produção.
 */
function cotarMock(itens) {
  const kg = Math.max(0.3, pesoTotal(itens));
  const round = (v) => Math.round(v * 100) / 100;
  return [
    { id: 1, name: 'PAC (simulado)', company: 'Correios', price: round(14.9 + 6 * kg), prazo: 7, prazoMin: 5, prazoMax: 8 },
    { id: 2, name: 'SEDEX (simulado)', company: 'Correios', price: round(24.9 + 10 * kg), prazo: 3, prazoMin: 2, prazoMax: 4 },
  ];
}

/** Monta o array `products` exigido pelo Melhor Envio a partir do carrinho. */
function montarProdutos(itens) {
  return itens.map((it, i) => {
    const e = resolverEmbalagem(it);
    const qty = Math.max(1, Number(it.qty) || 1);
    return {
      id: String(it.id || it.sku || i),
      width: e.width,
      height: e.height,
      length: e.length,
      weight: e.weight,
      insurance_value: Number(it.price) || 0, // valor declarado por unidade
      quantity: qty,
    };
  });
}

/**
 * Cota o frete para um CEP de destino.
 * @param {{ cepDestino:string, itens:Array<{id?,sku?,name?,price?,qty?}> }} args
 * @returns {Promise<Array<{id,name,company,price,prazo,prazoMin,prazoMax}>>}
 *          opções ordenadas do mais barato ao mais caro (só as disponíveis).
 */
export async function cotarFrete({ cepDestino, itens }) {
  const to = String(cepDestino || '').replace(/\D/g, '');
  if (to.length !== 8) throw new Error('CEP de destino inválido.');
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('Carrinho vazio.');

  // Modo simulação: não chama o Melhor Envio (útil p/ testar sem token real).
  if (isMock()) return cotarMock(itens);

  const { token, fromCep, userAgent } = getConfig();

  const url = isSandbox() ? SANDBOX_URL : PROD_URL;
  const body = {
    from: { postal_code: fromCep },
    to: { postal_code: to },
    products: montarProdutos(itens),
    options: { receipt: false, own_hand: false, insurance_value: 0 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Melhor Envio: ${msg}`);
  }

  // A resposta é um array de serviços; os indisponíveis vêm com `error`.
  const opcoes = (Array.isArray(data) ? data : [])
    .filter((s) => !s.error && s.price)
    .map((s) => ({
      id: s.id,
      name: s.name,
      company: s.company?.name || '',
      price: Number(s.price),
      prazo: s.delivery_time ?? s.delivery_range?.max ?? null,
      prazoMin: s.delivery_range?.min ?? s.delivery_time ?? null,
      prazoMax: s.delivery_range?.max ?? s.delivery_time ?? null,
    }))
    .sort((a, b) => a.price - b.price);

  return opcoes;
}

export default { cotarFrete };
