/* ================================================================
   Cliente Olist/Tiny — Cotação de frete por CEP
   Docs: https://tiny.com.br/api-docs/api2-cotacao-fretes
   ----------------------------------------------------------------
   Cota nas logísticas já configuradas na conta Olist (as mesmas do
   Olist Envios), então o preço mostrado no checkout é o preço da
   etiqueta que a loja emite depois. Substitui a cotação que antes
   passava pelo Melhor Envio (contas distintas => preços divergentes).

   Requer que os produtos estejam mapeados como anúncios na integração
   (ver `olist-produtos.js`), senão a Olist responde "Item não encontrado".

   Env necessárias:
   - TINY_TOKEN        → token da conta na Olist (o mesmo do resto da API)
   - TINY_ID_ECOMMERCE → id da integração "API do ERP" na Olist (17197)
   - TINY_CEP_ORIGEM   → opcional; deixe vazio para a Olist usar o CEP da
                         empresa, que é o mesmo de onde o Olist Envios coleta
   - FRETE_MOCK=true   → simula a cotação sem chamar a API (dev/testes)
   ================================================================ */

import { resolverEmbalagem } from './embalagem.js';

const BASE_URL = 'https://api.tiny.com.br/webhook/api/v1/parceiro';

/**
 * Rótulos para o `tipo_entrega`. Só entram em cena como fallback: a
 * conta devolve `nao_definida` em todas as cotações, e o nome útil para
 * o cliente vem em `nome_forma_frete` ("Jadlog - Normal", "Correios - PAC").
 */
const LABEL_TIPO_ENTREGA = {
  normal: 'Normal',
  expressa: 'Expressa',
  economica: 'Econômica',
  super_expressa: 'Super expressa',
  agendada: 'Agendada',
  retirada: 'Retirada na loja',
};

function isMock() {
  return String(process.env.FRETE_MOCK).toLowerCase() === 'true';
}

function getConfig() {
  const token = process.env.TINY_TOKEN;
  const idEcommerce = process.env.TINY_ID_ECOMMERCE;
  if (!token) throw new Error('TINY_TOKEN não configurado.');
  if (!idEcommerce) throw new Error('TINY_ID_ECOMMERCE não configurado.');
  const cepOrigem = (process.env.TINY_CEP_ORIGEM || '').replace(/\D/g, '');
  return { token, idEcommerce, cepOrigem };
}

/** Peso total do carrinho (kg) — usado apenas na simulação. */
function pesoTotal(itens) {
  return itens.reduce((s, it) => {
    const e = resolverEmbalagem(it);
    return s + e.weight * Math.max(1, Number(it.qty) || 1);
  }, 0);
}

/**
 * SIMULAÇÃO (`FRETE_MOCK=true`) — estimativa grosseira por peso, para
 * exercitar o fluxo do checkout sem bater na Olist. Nunca em produção.
 */
function cotarMock(itens) {
  const kg = Math.max(0.3, pesoTotal(itens));
  const round = (v) => Math.round(v * 100) / 100;
  return [
    { id: 'mock:normal', name: 'Normal (simulado)', company: 'Correios', price: round(14.9 + 6 * kg), prazo: 7, prazoMin: 7, prazoMax: 7 },
    { id: 'mock:expressa', name: 'Expressa (simulado)', company: 'Correios', price: round(24.9 + 10 * kg), prazo: 3, prazoMin: 3, prazoMax: 3 },
  ];
}

/**
 * Monta o array `itens` do payload.
 *
 * `peso` é omitido de propósito: todo SKU vendável já tem `peso_bruto`
 * preenchido no Tiny, que é a fonte única do catálogo — a Olist busca de
 * lá quando o campo não vem. (Um SKU com peso 0 cotaria errado em
 * silêncio, mas o único do catálogo nessa condição é filtrado por
 * `isOculto` em produtos.js.)
 *
 * As dimensões, ao contrário, vão explícitas: nenhum produto tem
 * embalagem cadastrada no Tiny, então sem isso a Olist cotaria com zeros.
 * Ver `embalagem.js`.
 */
function montarItens(itens) {
  return itens.map((it) => {
    const e = resolverEmbalagem(it);
    return {
      sku: String(it.sku),
      quantidade: Math.max(1, Number(it.qty) || 1),
      altura: e.height,
      largura: e.width,
      comprimento: e.length,
    };
  });
}

/** Uma opção da Olist → formato que o checkout consome. */
function normalizarOpcao(c) {
  const tipo = c.tipo_entrega || 'nao_definida';
  const prazo = Number(c.prazo);
  return {
    id: `${c.id_forma_envio}:${c.id_forma_frete}`,
    name: c.nome_forma_frete || LABEL_TIPO_ENTREGA[tipo] || 'Entrega',
    company: c.nome_forma_envio || '',
    price: Number(c.preco),
    prazo,
    prazoMin: prazo,
    prazoMax: prazo,
    // Guardados para conciliar com a etiqueta no Olist Envios.
    idFormaEnvio: c.id_forma_envio,
    idFormaFrete: c.id_forma_frete,
    tipoEntrega: tipo,
  };
}

/**
 * Cota o frete do carrinho inteiro para um CEP de destino.
 * @param {{ cepDestino:string, itens:Array<{sku:string,name?:string,qty?:number}> }} args
 * @returns {Promise<Array<{id,name,company,price,prazo,prazoMin,prazoMax}>>}
 *          uma opção por tipo de entrega, da mais barata à mais cara.
 */
export async function cotarFrete({ cepDestino, itens }) {
  const to = String(cepDestino || '').replace(/\D/g, '');
  if (to.length !== 8) throw new Error('CEP de destino inválido.');
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('Carrinho vazio.');

  if (isMock()) return cotarMock(itens);

  const semSku = itens.filter((it) => !it.sku);
  if (semSku.length) throw new Error('Itens sem SKU não podem ser cotados.');

  const { token, idEcommerce, cepOrigem } = getConfig();

  const body = {
    ...(cepOrigem ? { cep_origem: cepOrigem } : {}),
    cep_destino: to,
    itens: montarItens(itens),
    opcoes: {
      cotar_agrupado: true,         // um frete para o carrinho todo, não por item
      considerar_dias_preparacao: true,
      // Agrupar colapsaria tudo numa opção só: a conta devolve
      // `tipo_entrega: nao_definida` em todas as transportadoras. Sem
      // agrupar, o cliente escolhe entre Jadlog, Loggi, GFL, PAC e Sedex.
      agrupar_tipo_entrega: false,
    },
  };

  const res = await fetch(`${BASE_URL}/${idEcommerce}/cotar`, {
    method: 'POST',
    headers: {
      Token: token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Olist: ${data?.error || `HTTP ${res.status}`}`);
  }

  // Com `cotar_agrupado: true` a resposta traz as cotações no topo,
  // sem o aninhamento por SKU do modo não-agrupado.
  return (Array.isArray(data?.cotacoes) ? data.cotacoes : [])
    .filter((c) => Number.isFinite(Number(c.preco)) && Number(c.preco) >= 0)
    .map(normalizarOpcao)
    .sort((a, b) => a.price - b.price);
}

export default { cotarFrete };
