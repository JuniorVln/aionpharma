# Integração Aion Pharma — Tiny ERP + Mercado Pago

Guia para colocar a loja integrada no ar. Você cuida das partes de **conta/credencial**
(passos 1 a 4); o código do backend já está pronto na pasta `api/`.

---

## Visão geral do fluxo

```
Cliente no site  →  /api/checkout  →  cria pedido no TINY (situação "aberto")
                                   →  cria pagamento no MERCADO PAGO
                                   →  redireciona o cliente para pagar
Cliente paga     →  Mercado Pago   →  /api/webhook
                                   →  atualiza pedido no TINY p/ "aprovado"
                                   →  (opcional) emite NF-e
```

- **Tiny** = catálogo, estoque, pedido, financeiro, NF-e.
- **Mercado Pago** = cobrança (Pix, cartão, boleto).
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
3. Copie o **Access Token**.

---

## Passo 4 — Configurar as variáveis de ambiente na Vercel

No painel da Vercel → projeto **aionpharma** → **Settings → Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `TINY_TOKEN` | token do Passo 1 |
| `MERCADOPAGO_ACCESS_TOKEN` | access token do Passo 3 (comece com o de **teste**) |
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
| `POST /api/checkout` | Cria o pedido no Tiny + inicia o pagamento no Mercado Pago |
| `POST /api/webhook` | Recebe a confirmação do Mercado Pago e atualiza o pedido no Tiny |

---

## O que falta no código (próximos passos, após o token)

- [ ] Religar o catálogo do site para consumir `GET /api/produtos` (hoje os produtos
      estão fixos no HTML com dados fictícios).
- [ ] Trocar o checkout-WhatsApp por um formulário de dados do cliente que chama
      `POST /api/checkout` e redireciona para o Mercado Pago.
- [ ] Página `pedido-confirmado` (retorno do pagamento).
- [ ] Testar o fluxo ponta a ponta com credenciais de **teste** do Mercado Pago.

> Esses passos precisam do `TINY_TOKEN` real para validar os nomes dos campos que o
> Tiny devolve (preço, imagem, estoque). Assim que você tiver o token, a gente testa
> ao vivo e ajusta.
