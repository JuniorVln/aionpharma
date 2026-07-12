-- Aion Pharma CRM — schema de cupons / influencers
-- Rode no SQL Editor do Supabase (Dashboard → SQL → New query).

-- ── Influencers ──────────────────────────────────────────────
create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  instagram text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Cupons ───────────────────────────────────────────────────
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  desconto_percent numeric(5,2) not null check (desconto_percent > 0 and desconto_percent <= 100),
  valido_de timestamptz,
  valido_ate timestamptz,
  ativo boolean not null default true,
  influencer_id uuid references public.influencers(id) on delete set null,
  usos integer not null default 0,
  created_at timestamptz not null default now(),
  constraint coupons_codigo_unique unique (codigo)
);

create index if not exists coupons_codigo_idx on public.coupons (codigo);
create index if not exists coupons_influencer_idx on public.coupons (influencer_id);

-- ── Resgates (após pagamento aprovado) ───────────────────────
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  pedido_id text not null,
  pedido_numero text,
  email_cliente text,
  valor_pedido numeric(12,2) not null default 0,
  valor_desconto numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_pedido_unique unique (pedido_id)
);

create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id);

-- ── Vínculo temporário pedido↔cupom (até o webhook confirmar) ─
create table if not exists public.checkout_coupons (
  pedido_id text primary key,
  pedido_numero text,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  codigo text,
  email_cliente text,
  valor_pedido numeric(12,2) not null default 0,
  valor_desconto numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.checkout_coupons enable row level security;

create policy "admins_all_checkout_coupons"
  on public.checkout_coupons for all
  to authenticated
  using (true) with check (true);

-- Normaliza código em maiúsculas
create or replace function public.coupons_normalize_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := upper(trim(new.codigo));
  return new;
end;
$$;

drop trigger if exists trg_coupons_normalize_codigo on public.coupons;
create trigger trg_coupons_normalize_codigo
  before insert or update of codigo on public.coupons
  for each row execute function public.coupons_normalize_codigo();

-- Incrementa contador de usos de forma atômica
create or replace function public.increment_coupon_usos(p_coupon_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.coupons
  set usos = usos + 1
  where id = p_coupon_id;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────
-- Tabelas não são acessíveis pelo anon key diretamente.
-- O painel e a loja passam pelas APIs serverless (service role).
alter table public.influencers enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Usuários autenticados (admins) podem ler/escrever via anon key + JWT
-- (alternativa às APIs; as APIs usam service role e ignoram RLS).
create policy "admins_all_influencers"
  on public.influencers for all
  to authenticated
  using (true) with check (true);

create policy "admins_all_coupons"
  on public.coupons for all
  to authenticated
  using (true) with check (true);

create policy "admins_all_redemptions"
  on public.coupon_redemptions for all
  to authenticated
  using (true) with check (true);
