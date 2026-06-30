/* ================================================================
   Cliente Tiny ERP — API v2 (token estático)
   Docs: https://tiny.com.br/api-docs/api2
   ----------------------------------------------------------------
   Chamadas: POST x-www-form-urlencoded com token + formato=json.
   Resposta encapsulada em { retorno: { status, ... } }.
   ================================================================ */

const BASE_URL = 'https://api.tiny.com.br/api2';

function getToken() {
  const token = process.env.TINY_TOKEN;
  if (!token) throw new Error('TINY_TOKEN não configurado.');
  return token;
}

async function call(service, params = {}) {
  const body = new URLSearchParams({ token: getToken(), formato: 'json', ...params });
  const res = await fetch(`${BASE_URL}/${service}.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Tiny ${service}: HTTP ${res.status}`);
  const data = await res.json();
  const retorno = data?.retorno;
  if (!retorno) throw new Error(`Tiny ${service}: resposta inesperada`);
  if (retorno.status === 'Erro') {
    const erros = (retorno.erros || []).map((e) => e.erro || JSON.stringify(e)).join('; ');
    const err = new Error(`Tiny ${service}: ${erros || 'erro desconhecido'}`);
    err.tinyRetorno = retorno;
    throw err;
  }
  return retorno;
}

/* ── Produtos ───────────────────────────────────────────────── */

/** Lista a página do catálogo (sem `pesquisa`, retorna o catálogo). */
export async function pesquisarProdutos({ pesquisa = '', pagina = 1 } = {}) {
  const retorno = await call('produtos.pesquisa', { pesquisa, pagina });
  return (retorno.produtos || []).map((p) => p.produto);
}

/** Detalhe completo de um produto (descrição, imagens, etc.). */
export async function obterProduto(id) {
  const retorno = await call('produto.obter', { id });
  return retorno.produto;
}

/** Saldo de estoque de um produto. */
export async function obterEstoque(id) {
  const retorno = await call('produto.obter.estoque', { id });
  return retorno.produto;
}

/** Extrai a 1ª imagem de um produto (anexos ou imagens_externas). */
export function extrairImagem(produto) {
  const anexo = produto?.anexos?.[0]?.anexo;
  if (anexo) return anexo;
  const ext = produto?.imagens_externas?.[0]?.imagem_externa?.url;
  if (ext) return ext;
  return '';
}

/* ── Pedidos ────────────────────────────────────────────────── */

export async function incluirPedido(pedido) {
  const retorno = await call('pedido.incluir', { pedido: JSON.stringify({ pedido }) });
  const registro = retorno.registros?.registro || retorno.registro || {};
  return { id: registro.id, numero: registro.numero, retorno };
}

export async function obterPedido(id) {
  const retorno = await call('pedido.obter', { id });
  return retorno.pedido;
}

export async function alterarSituacaoPedido(id, situacao) {
  return call('pedido.alterar.situacao', { id, situacao });
}

/* ── Nota Fiscal ────────────────────────────────────────────── */

export async function gerarNotaFiscal(idPedido, modelo = '55') {
  return call('pedido.gerar.nota.fiscal', { id: idPedido, modelo });
}

export async function emitirNotaFiscal(idNota) {
  return call('nota.fiscal.emitir', { id: idNota });
}

/* ── Helper: montar pedido a partir do carrinho ─────────────── */

export function montarPedido({ cliente, itens, observacoes = '', situacao = 'aberto', frete = null }) {
  // frete = { id, name, company, price } escolhido pelo cliente (Melhor Envio).
  // O valor vai no pedido para conciliar com a etiqueta gerada no Olist Envios.
  const valorFrete = frete && Number(frete.price) > 0 ? Number(frete.price) : 0;
  const formaEnvio = frete ? [frete.company, frete.name].filter(Boolean).join(' ') : '';
  const obsFrete = formaEnvio ? `Frete escolhido: ${formaEnvio} (R$ ${valorFrete.toFixed(2)}).` : '';
  return {
    data_pedido: '',
    situacao,
    valor_frete: valorFrete,
    frete_por_conta: 'R', // R = por conta do Remetente (loja despacha via Olist Envios)
    forma_envio: formaEnvio,
    cliente: {
      nome: cliente.nome,
      tipoPessoa: cliente.tipoPessoa || 'F',
      cpf_cnpj: cliente.cpfCnpj || '',
      email: cliente.email || '',
      fone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cep: cliente.cep || '',
      cidade: cliente.cidade || '',
      uf: cliente.uf || '',
    },
    itens: itens.map((item) => ({
      item: {
        codigo: item.sku || item.id || '',
        descricao: item.name,
        unidade: 'UN',
        quantidade: item.qty,
        valor_unitario: item.price,
      },
    })),
    obs: [observacoes, obsFrete].filter(Boolean).join(' '),
  };
}

export default {
  pesquisarProdutos,
  obterProduto,
  obterEstoque,
  extrairImagem,
  incluirPedido,
  obterPedido,
  alterarSituacaoPedido,
  gerarNotaFiscal,
  emitirNotaFiscal,
  montarPedido,
};
