/* ================================================================
   POST /api/olist-produtos
   Webhook "Envio de produtos" da Olist.
   Docs: https://tiny.com.br/api-docs/api2-webhooks-envio-produtos
   ----------------------------------------------------------------
   Quando o seller clica em "Enviar para o e-commerce" no ERP, a Olist
   faz um POST deste payload para cá, um produto por vez, e espera
   receber de volta o identificador do produto NA NOSSA plataforma.
   Isso cria o "anúncio"/mapeamento no lado da Olist — e é justamente
   esse mapeamento que a cotação de frete consulta pelo `sku`.

   Sem este endpoint, /api/frete responde "Item 'XXXX' não encontrado".

   Como o site é uma vitrine sobre o próprio catálogo do Tiny, o
   identificador que devolvemos é o `codigo` (SKU) do produto. Assim
   `sku` na cotação == `codigo` no Tiny, sem tabela de-para.

   Configurar em: ERP → Integrações → API do ERP → Notificações →
   "URL para envio de produtos" = <SITE_URL>/api/olist-produtos
   ================================================================ */

const CNPJ_ESPERADO = '62549376000107'; // conta Aion Pharma

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/** Só numeros, para comparar CNPJ sem depender de formatação. */
const digitos = (v) => String(v || '').replace(/\D/g, '');

/**
 * Monta o mapeamento de um produto (ou variação): devolve à Olist o
 * `idMapeamento` que ela mandou, casado com o nosso identificador.
 * Produto sem `codigo` não pode ser mapeado — a cotação o buscaria por
 * um SKU inexistente. Devolvemos `error`, que o ERP mostra ao usuário.
 */
function mapear(item, siteUrl) {
  const idMapeamento = item?.idMapeamento;
  const sku = String(item?.codigo || '').trim();

  if (!sku) {
    return { idMapeamento, skuMapeamento: '', error: 'Produto sem código (SKU) cadastrado no Tiny.' };
  }

  const mapeamento = { idMapeamento, skuMapeamento: sku };
  if (siteUrl && item?.id) mapeamento.urlProduto = `${siteUrl}/produto.html?id=${item.id}`;
  return mapeamento;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const payload = await readJson(req);
    const { cnpj, idEcommerce, tipo, dados } = payload;

    // A Olist não assina o webhook; conferimos a conta e a integração.
    // Qualquer retorno fora de HTTP 200 faz o ERP rejeitar o mapeamento.
    if (digitos(cnpj) !== CNPJ_ESPERADO) {
      console.warn('[/api/olist-produtos] CNPJ inesperado:', digitos(cnpj));
      return res.status(401).json({ error: 'CNPJ não autorizado' });
    }

    const esperado = process.env.TINY_ID_ECOMMERCE;
    if (esperado && String(idEcommerce) !== String(esperado)) {
      console.warn('[/api/olist-produtos] idEcommerce inesperado:', idEcommerce);
      return res.status(401).json({ error: 'Integração não autorizada' });
    }

    if (tipo && tipo !== 'produto') {
      return res.status(400).json({ error: `Tipo de webhook não suportado: ${tipo}` });
    }
    if (!dados || typeof dados !== 'object') {
      return res.status(400).json({ error: 'Payload sem o elemento "dados".' });
    }

    const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

    // O produto pai e cada variação viram um mapeamento. Nosso catálogo
    // não usa variações hoje, mas a Olist as envia no mesmo payload.
    const itens = [dados, ...(Array.isArray(dados.variacoes) ? dados.variacoes : [])];
    const mapeamentos = itens.map((item) => mapear(item, siteUrl));

    console.log('[/api/olist-produtos]', dados.codigo || dados.id, '→', mapeamentos.length, 'mapeamento(s)');

    return res.status(200).json(mapeamentos);
  } catch (err) {
    console.error('[/api/olist-produtos]', err.message);
    return res.status(500).json({ error: 'Falha ao processar o webhook', detail: err.message });
  }
}
