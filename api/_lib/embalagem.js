/* ================================================================
   Peso e dimensões de embalagem por produto (para cotação de frete)
   ----------------------------------------------------------------
   O Tiny ainda NÃO tem peso/dimensões preenchidos nos SKUs
   (peso_bruto: 0, embalagem vazia), então a cotação real depende
   destes valores. Eles são casados por palavra-chave do NOME do
   produto (o carrinho do site guarda `name`, não `sku`).

   ⚠️  AJUSTAR: os números abaixo são ESTIMATIVAS de partida.
   Confirme os valores reais (balança + régua, produto JÁ embalado
   para envio) — o frete cobrado do cliente depende disso.
   Unidades: peso em KG, dimensões em CM (padrão do Melhor Envio).
   Mínimos dos Correios: 16×11×2 cm. Não cadastre abaixo disso.
   ================================================================ */

// Fallback usado quando nenhuma regra casa.
const PADRAO = { weight: 0.3, width: 16, height: 4, length: 16 };

// Regras avaliadas em ordem; a 1ª que casar vence. `match` recebe o
// nome do produto já em minúsculas.
const REGRAS = [
  {
    // Gel dental TartOff 100 ml (frasco maior)
    match: (n) => (n.includes('gel') || n.includes('tartoff')) && n.includes('100'),
    embalagem: { weight: 0.2, width: 16, height: 5, length: 16 },
  },
  {
    // Gel dental TartOff 50 ml (frasco menor)
    match: (n) => (n.includes('gel') || n.includes('tartoff')) && n.includes('50'),
    embalagem: { weight: 0.12, width: 16, height: 3, length: 16 },
  },
  {
    // Green Cat — areia de gato (item pesado, dimensiona o frete)
    match: (n) => n.includes('areia') || n.includes('green cat'),
    embalagem: { weight: 2.0, width: 25, height: 10, length: 18 }, // AJUSTAR: peso real do pacote
  },
  {
    // Everbone — ossos de nylon
    match: (n) => n.includes('osso') || n.includes('everbone') || n.includes('nylon'),
    embalagem: { weight: 0.18, width: 16, height: 5, length: 20 },
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
