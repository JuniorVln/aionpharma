-- ================================================================
-- Vitrine editável — o que o Gabriel mexe sem depender de deploy
--
-- Duas coisas moram aqui:
--   1. vitrine_destaque  — o bloco grande da home (foto + texto + CTA)
--   2. vitrine_produtos  — correções por produto (nome, descrição, foto)
--
-- Preço e código NUNCA moram aqui: continuam vindo do Tiny/Olist.
-- O override só cobre o que o ERP escreve errado ou não tem (foto).
-- ================================================================

create table if not exists public.vitrine_destaque (
  id            integer primary key default 1 check (id = 1),
  ativo         boolean not null default true,
  badge         text,
  titulo        text,
  titulo_realce text,           -- parte do título em dourado
  texto         text,
  beneficios    jsonb not null default '[]'::jsonb,  -- ["linha 1", "linha 2"]
  sku           text,           -- de onde vem o "a partir de R$"
  preco_prefixo text default 'a partir de',
  cta_label     text,
  cta_url       text,
  cta2_label    text,
  cta2_url      text,
  imagem_url    text,           -- foto por link
  imagem_mime   text,           -- ou foto enviada pelo painel
  imagem_bytes  bytea,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.vitrine_produtos (
  sku           text primary key,
  nome          text,
  descricao     text,
  imagem_url    text,
  imagem_mime   text,
  imagem_bytes  bytea,
  oculto        boolean not null default false,
  ordem         integer,
  atualizado_em timestamptz not null default now()
);

-- Semente do destaque = exatamente o que já está no ar hoje, para o
-- painel abrir mostrando o site real em vez de campos vazios.
insert into public.vitrine_destaque (
  id, ativo, badge, titulo, titulo_realce, texto, beneficios, sku,
  cta_label, cta_url, imagem_url
) values (
  1, true,
  '⭐ Produto Mais Vendido',
  'Diga Adeus ao',
  'Tártaro',
  'O Tartoff é um gel de higiene oral formulado com ingredientes naturais — Aloe Vera, Chá Verde, Alecrim e Menta — para remover a placa bacteriana e combater o tártaro de forma gentil, sem necessidade de escovação forçada.',
  '["Para cães e gatos de todas as raças e idades","Sem fluoreto, sem parabenos — seguro se ingerido","Resultados visíveis em 2 a 4 semanas de uso","Sabor palatável — os pets adoram!"]'::jsonb,
  '1173',
  'Ver a Linha TartOff',
  'produtos.html',
  '/assets/produtos/gel-tartoff-lineup.png'
)
on conflict (id) do nothing;
