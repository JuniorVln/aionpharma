# Integração Aion Pharma — Tiny ERP + Mercado Pago

Guia para colocar a loja integrada no ar. Você cuida das partes de **conta/credencial**
(passos 1 a 4); o código do backend já está pronto na pasta `api/`.

---

## Visão geral do fluxo

```
Cliente digita CEP →  /api/frete    →  cota PAC/Sedex/... no MELHOR ENVIO
Cliente no site    →  /api/checkout →  cria pedido no TINY (com frete escolhido)
                                     →  cria pagamento no MERCADO PAGO (frete somado)
                                     →  redireciona o cliente para pagar
Cliente paga       →  Mercado Pago  →  /api/webhook
                                     →  atualiza pedido no TINY p/ "aprovado"
                                     →  (opcional) emite NF-e
Loja despacha      →  Tiny          →  gera ETIQUETA no OLIST ENVIOS
```

- **Tiny** = catálogo, estoque, pedido, financeiro, NF-e.
- **Mercado Pago** = cobrança (Pix, cartão, boleto).
- **Melhor Envio** = cotação do frete por CEP no checkout (o Olist não cota por API).
- **Olist Envios** (dentro do Tiny) = contratação da transportadora e impressão da etiqueta.
- **Vercel** = onde o site e o backend `/api` rodam.

---

## Passo 1 — Gerar o Token da API no Tiny

1. Entre no painel do Tiny.
2. Vá em **Início → Extensões da Olist** → seção **Vendas** → instale a extensão **"Token API"**.
3. Depois vá em **Configurações → aba E-commerce → Token API**.
4. Copie o token gerado (uma sequência longa de letras/números).

> ⚠️ Esse token dá acesso aos dados da sua conta. Trate como senha. Ele vai **só** nas
> variáveis de ambiente da Vercel, nunca no código nem no navegador.

---

## Passo 2 — Cadastrar os produtos no Tiny

O catálogo do site vai espelhar o que estiver no Tiny. Para cada produto (Tartoff, Pellet, kits):

- **Nome**, **código (SKU)**, **preço** (e preço promocional, se houver).
- **Foto** do produto (o site usa a imagem cadastrada).
- **Estoque** com saldo real.
- Situação **Ativo**.

---

## Passo 3 — Criar a conta no Mercado Pago e pegar as credenciais

1. Acesse <https://www.mercadopago.com.br/developers> → **Suas integrações** → crie uma aplicação.
2. Em **Credenciais**, você terá dois conjuntos:
   - **Teste** (`TEST-...`) — use para validar sem cobrar de verdade.
   - **Produção** (`APP_USR-...`) — use no lançamento.
3. Copie, do **mesmo conjunto** (teste ou produção), as duas credenciais:
   - **Access Token** → `MERCADOPAGO_ACCESS_TOKEN` (fica só no backend).
   - **Public Key** → `MERCADOPAGO_PUBLIC_KEY` (vai para o frontend; é pública por natureza
     e é o que faz o checkout abrir **embutido no site**, num modal, via Wallet Brick).

> ⚠️ As duas credenciais precisam ser do **mesmo ambiente**. Misturar Public Key de teste
> com Access Token de produção (ou vice-versa) faz o pagamento falhar.

---

## Passo 3.5 — Entregas: Olist Envios (etiqueta) + Melhor Envio (cotação)

O Olist/Tiny **não cota frete por API** — ele cuida da **etiqueta**. A **cotação** por CEP
no checkout vem do **Melhor Envio**. As duas coisas convivem: o cliente vê o preço (Melhor
Envio) e você imprime a etiqueta (Olist Envios) quando o pedido é pago.

**a) Olist Envios (já ativo na conta):** nada a fazer no código. Quando o pedido é pago, ele
aparece no Tiny já com o endereço e o valor de frete; você gera a etiqueta dentro do Tiny.

**b) Melhor Envio (cotação):**
1. Crie conta grátis em <https://melhorenvio.com.br> e complete o cadastro da empresa.
2. Pegue um **token de API**: conta → **Integrações / Tokens de API** (ou crie um app OAuth).
   Use o token de **Sandbox** enquanto valida.
3. Anote o **CEP de origem** (de onde você despacha) — vai em `MELHORENVIO_FROM_CEP`.

> ⚠️ **Pré-requisito que trava a cotação:** os produtos no Tiny estão com **peso e
> dimensões zerados**. Sem isso a cotação é imprecisa ou falha. Enquanto não preenche no
> Tiny, o backend usa estimativas em `api/_lib/embalagem.js` — **confirme os valores reais**
> (frasco já embalado para envio) e me avise para ajustar, especialmente a **areia de gato**
> (item pesado, é o que mais mexe no frete).

---

## Passo 4 — Configurar as variáveis de ambiente na Vercel

No painel da Vercel → projeto **aionpharma** → **Settings → Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `TINY_TOKEN` | token do Passo 1 |
| `MERCADOPAGO_ACCESS_TOKEN` | access token do Passo 3 (comece com o de **teste**) |
| `MERCADOPAGO_PUBLIC_KEY` | public key do Passo 3 (mesmo ambiente do access token) |
| `MELHORENVIO_TOKEN` | token do Melhor Envio (Passo 3.5) |
| `MELHORENVIO_SANDBOX` | `true` enquanto testa; `false` no lançamento |
| `MELHORENVIO_FROM_CEP` | CEP de origem (de onde a loja despacha) |
| `MELHORENVIO_USER_AGENT` | `Aion Pharma (marketing@tartoff.com.br)` |
| `SITE_URL` | URL pública do site, ex.: `https://aionpharma.vercel.app` |
| `FREE_SHIPPING_THRESHOLD` | `99` (frete grátis acima desse valor; `0` desativa) |
| `AUTO_EMIT_NFE` | `false` (ligue quando o fiscal estiver pronto) |

Depois de salvar, faça um **redeploy** para as variáveis entrarem em vigor.

Para rodar localmente: copie `.env.example` para `.env` e preencha os mesmos valores
(`npm i -g vercel` e depois `vercel dev`).

---

## Passo 5 — Configuração fiscal (NF-e) — pode ficar para depois

A emissão automática de NF-e exige, **dentro do Tiny**:
- Certificado digital **A1** instalado.
- Regime tributário e dados fiscais configurados.

Enquanto isso não estiver pronto, deixe `AUTO_EMIT_NFE=false`. A loja vende normalmente;
só a emissão da nota fica manual no Tiny.

---

## Endpoints do backend (já implementados)

| Rota | O que faz |
|---|---|
| `GET /api/produtos` | Lista os produtos do Tiny já normalizados para o site |
| `POST /api/frete` | Cota o frete por CEP (Melhor Envio) para os itens do carrinho |
| `POST /api/checkout` | Cria o pedido no Tiny (com frete) + inicia o pagamento no Mercado Pago |
| `POST /api/webhook` | Recebe a confirmação do Mercado Pago e atualiza o pedido no Tiny |

---

## O que falta no código (próximos passos, após o token)

- [ ] Religar o catálogo do site para consumir `GET /api/produtos` (hoje os produtos
      estão fixos no HTML com dados fictícios).
- [x] ~~Trocar o checkout-WhatsApp por um formulário de dados do cliente~~ — feito. O
      carrinho cota o frete (`POST /api/frete`), o cliente preenche os dados e o pagamento
      abre **embutido no site** (modal do Mercado Pago / Wallet Brick) via `POST /api/checkout`.
      O WhatsApp foi removido do checkout.
- [ ] Página `pedido-confirmado` (retorno do pagamento — usada nas `back_urls`).
- [ ] Testar o fluxo ponta a ponta com credenciais de **teste** do Mercado Pago.

> Esses passos precisam do `TINY_TOKEN` real para validar os nomes dos campos que o
> Tiny devolve (preço, imagem, estoque). Assim que você tiver o token, a gente testa
> ao vivo e ajusta.
