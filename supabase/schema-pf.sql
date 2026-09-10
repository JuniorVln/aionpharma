-- Aion Pharma — Conta do cliente pessoa física (CPF)
--
-- Onde rodar: banco `aion` do Postgres da VPS (o Supabase saiu em 09/09/2026).
--   ssh root@178.18.248.126
--   docker exec -i hq-postgres psql -U aion -d aion < schema-pf.sql
--
-- Por que uma tabela separada de b2b_accounts: PF e PJ não compartilham
-- regra de preço (PF compra sempre na tabela Cliente Final), nem documento,
-- nem aprovação manual. Misturar as duas na mesma tabela obrigaria a
-- checar o tipo em toda query de preço — o lugar exato onde um erro
-- vazaria preço de custo para o consumidor final.

create table if not exists public.pf_accounts (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  nome text not null,
  email text not null,
  telefone text,
  senha_hash text not null,
  ativo boolean not null default true,
  -- Endereço padrão (prefill do checkout; o cliente pode trocar na hora)
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  -- Proteção contra força bruta no login
  tentativas_falhas integer not null default 0,
  bloqueado_ate timestamptz,
  ultimo_login timestamptz,
  created_at timestamptz not null default now(),
  constraint pf_accounts_cpf_unique unique (cpf),
  constraint pf_accounts_email_unique unique (email)
);

create index if not exists pf_accounts_email_idx on public.pf_accounts (lower(email));

-- Pedidos feitos com a conta PF logada (histórico do "Meus pedidos").
-- O pedido continua sendo criado na Olist/Tiny; aqui fica só o vínculo.
create table if not exists public.pf_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.pf_accounts (id) on delete cascade,
  pedido_id text not null,
  pedido_numero text,
  valor_itens numeric(12, 2) not null default 0,
  valor_frete numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint pf_orders_pedido_unique unique (pedido_id)
);

create index if not exists pf_orders_account_idx on public.pf_orders (account_id);
