/* ================================================================
   Dimensões de embalagem por produto (para cotação de frete)
   ----------------------------------------------------------------
   O `peso_bruto` dos SKUs já está preenchido no Tiny e é a fonte
   única — a cotação NÃO usa o `weight` daqui (ver `olistfrete.js`).
   As DIMENSÕES, porém, estão vazias em todos os produtos do Tiny,
   e é isso que este módulo supre. São casadas por palavra-chave do
   NOME do produto.

   ⚠️  AJUSTAR: as dimensões abaixo são ESTIMATIVAS de partida.
   Confirme com régua no produto JÁ embalado para envio — o frete
   cobrado do cliente depende disso. O ideal é cadastrá-las no Tiny
   e aposentar este módulo.

   `weight` é mantido só para a simulação (`FRETE_MOCK=true`) e para
   o `melhorenvio.js` legado; espelha o peso_bruto real do Tiny.
   Unidades: peso em KG, dimensões em CM.
   Mínimos dos Correios: 16×11×2 cm. Não cadastre abaixo disso.
   ================================================================ */

// Fallback usado quando nenhuma regra casa.
const PADRAO = { weight: 0.3, width: 16, height: 4, length: 16 };

// Regras avaliadas em ordem; a 1ª que casar vence. `match` recebe o
// nome do produto já em minúsculas.
const REGRAS = [
  {
    // Gel dental TartOff 100 ml (frasco maior) — SKUs 1174/1172
    match: (n) => (n.includes('gel') || n.includes('tartoff')) && n.includes('100'),
    embalagem: { weight: 0.112, width: 16, height: 5, length: 16 },
  },
  {
    // Gel dental TartOff 50 ml (frasco menor) — SKUs 1175/1173
    match: (n) => (n.includes('gel') || n.includes('tartoff')) && n.includes('50'),
    embalagem: { weight: 0.058, width: 16, height: 3, length: 16 },
  },
  {
    // Green Cat — areia de gato (item pesado, dimensiona o frete) — SKU 0005
    match: (n) => n.includes('areia') || n.includes('green cat'),
    embalagem: { weight: 2.01, width: 25, height: 10, length: 18 },
  },
  {
    // Everbone — ossos de nylon. Peso varia por tamanho no Tiny
    // (P 0,053 / M 0,135 / G 0,287); aqui fica a média, que só afeta o mock.
    match: (n) => n.includes('osso') || n.includes('everbone') || n.includes('nylon'),
    embalagem: { weight: 0.158, width: 16, height: 5, length: 20 },
  },
];

/**
 * Resolve a embalagem (peso/dimensões) de um item do carrinho.
 * @param {{name?:string}} item
 * @returns {{weight:number,width:number,height:number,length:number}}
 */
export function resolverEmbalagem(item) {
  const nome = (item?.name || '').toLowerCase();
  const regra = REGRAS.find((r) => r.match(nome));
  return regra ? regra.embalagem : PADRAO;
}

export default { resolverEmbalagem };
