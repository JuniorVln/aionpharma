-- Aion Pharma — Área de compra com CNPJ (B2B)
-- Rode no SQL Editor do Supabase (Dashboard → SQL → New query).
--
-- Nível define a tabela de preço lida na Olist/Tiny:
--   lojista      → TINY_ID_LISTA_PRECO_LOJISTA      (103 na conta Aion)
--   distribuicao → TINY_ID_LISTA_PRECO_DISTRIBUICAO (102 na conta Aion)
-- Todo cadastro nasce como "lojista"; o painel /admin promove quem for
-- distribuidor.

create table if not exists public.b2b_accounts (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null,
  razao_social text not null,
  nome_fantasia text,
  email text not null,
  telefone text,
  contato_nome text,
  senha_hash text not null,
  nivel text not null default 'lojista' check (nivel in ('lojista', 'distribuicao')),
  ativo boolean not null default true,
  -- Endereço padrão (prefill do checkout; o cliente pode trocar na hora)
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  -- Auditoria do cadastro automático
  cnpj_situacao text,
  cnpj_verificado boolean not null default false,
  -- Proteção contra força bruta no login
  tentativas_falhas integer not null default 0,
  bloqueado_ate timestamptz,
  ultimo_login timestamptz,
  created_at timestamptz not null default now(),
  constraint b2b_accounts_cnpj_unique unique (cnpj),
  constraint b2b_accounts_email_unique unique (email)
);

create index if not exists b2b_accounts_email_idx on public.b2b_accounts (lower(email));
create index if not exists b2b_accounts_nivel_idx on public.b2b_accounts (nivel);

-- Pedidos feitos pela área B2B (rastro para conferir preço aplicado)
create table if not exists public.b2b_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.b2b_accounts(id) on delete cascade,
  pedido_id text not null,
  pedido_numero text,
  nivel text not null,
  id_lista_preco text,
  valor_itens numeric(12,2) not null default 0,
  valor_frete numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint b2b_orders_pedido_unique unique (pedido_id)
);

create index if not exists b2b_orders_account_idx on public.b2b_orders (account_id);

-- ── RLS ──────────────────────────────────────────────────────
-- Sem policy: só a service role (APIs serverless) enxerga. O login do
-- lojista é JWT próprio, não Supabase Auth — dar acesso a
-- `authenticated` aqui abriria a base de clientes e o hash das senhas.
alter table public.b2b_accounts enable row level security;
alter table public.b2b_orders enable row level security;

-- Normaliza CNPJ (só 0-9A-Z) e e-mail (minúsculas) antes de gravar
create or replace function public.b2b_accounts_normalize()
returns trigger
language plpgsql
as $$
begin
  new.cnpj := upper(regexp_replace(new.cnpj, '[^0-9A-Za-z]', '', 'g'));
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_b2b_accounts_normalize on public.b2b_accounts;
create trigger trg_b2b_accounts_normalize
  before insert or update of cnpj, email on public.b2b_accounts
  for each row execute function public.b2b_accounts_normalize();
