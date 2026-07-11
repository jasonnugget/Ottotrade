-- Supabase schema for the current portfolio demo.
-- This preserves the future auth-oriented tables and adds public demo tables
-- so the portfolio can ship on Vercel before login is integrated.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company text not null,
  sector text not null,
  allocation_usd numeric not null,
  allocation_pct numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.portfolio_holdings enable row level security;

drop policy if exists "Users can view their own holdings" on public.portfolio_holdings;
create policy "Users can view their own holdings"
  on public.portfolio_holdings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own holdings" on public.portfolio_holdings;
create policy "Users can insert their own holdings"
  on public.portfolio_holdings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own holdings" on public.portfolio_holdings;
create policy "Users can update their own holdings"
  on public.portfolio_holdings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own holdings" on public.portfolio_holdings;
create policy "Users can delete their own holdings"
  on public.portfolio_holdings for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.portfolio_holdings (user_id, ticker, company, sector, allocation_usd, allocation_pct)
  values
    (new.id, 'AAPL', 'Apple',           'Consumer tech / hardware',   10000, 20),
    (new.id, 'TSLA', 'Tesla',           'EV / auto / energy',          8000, 16),
    (new.id, 'NVDA', 'Nvidia',          'Semiconductors / AI',         7000, 14),
    (new.id, 'AMZN', 'Amazon',          'E-commerce / cloud',          7000, 14),
    (new.id, 'MSFT', 'Microsoft',       'Cloud / enterprise software', 6000, 12),
    (new.id, 'XOM',  'ExxonMobil',      'Energy / oil & gas',          7000, 14),
    (new.id, 'DAL',  'Delta Air Lines', 'Airlines / travel',           5000, 10)
  on conflict (user_id, ticker) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.demo_portfolio_meta (
  id text primary key,
  capital numeric not null,
  purchase_date text not null,
  purchase_ts timestamptz not null,
  snapshot_date text not null,
  snapshot_ts timestamptz not null,
  snapshot_hour_est integer not null
);

create table if not exists public.demo_portfolio_holdings (
  ticker text primary key,
  company text not null,
  sector text not null,
  allocation_usd numeric not null,
  allocation_pct numeric not null,
  buy_price numeric not null,
  buy_price_method text not null,
  snapshot_price numeric not null,
  snapshot_price_method text not null,
  shares numeric not null
);

create table if not exists public.demo_events (
  id text primary key,
  event_date timestamptz not null,
  headline text not null,
  category text not null,
  location_lat numeric,
  location_lon numeric,
  location_name text,
  source_outlet text,
  source_url text,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  related_event_ids text[] not null default '{}',
  confidence_tier text not null,
  magnitude numeric not null default 0
);

create index if not exists demo_events_date_idx on public.demo_events (event_date);

create table if not exists public.demo_event_impacts (
  id bigint generated always as identity primary key,
  event_id text not null references public.demo_events(id) on delete cascade,
  ticker text not null,
  tier text not null,
  direction text not null,
  reasoning text not null,
  pct_change numeric,
  price numeric,
  reaction_date date
);

create index if not exists demo_event_impacts_event_idx on public.demo_event_impacts (event_id);
create index if not exists demo_event_impacts_ticker_idx on public.demo_event_impacts (ticker);

create table if not exists public.demo_event_edges (
  id bigint generated always as identity primary key,
  source_event_id text not null references public.demo_events(id) on delete cascade,
  target_event_id text not null references public.demo_events(id) on delete cascade,
  weight numeric not null,
  declared boolean not null default false,
  unique (source_event_id, target_event_id)
);

create table if not exists public.demo_stock_bars (
  id bigint generated always as identity primary key,
  ticker text not null,
  interval text not null check (interval in ('1d', '5m')),
  bar_ts timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  adjclose numeric not null,
  volume bigint not null default 0
);

create index if not exists demo_stock_bars_lookup_idx
  on public.demo_stock_bars (ticker, interval, bar_ts);

alter table public.demo_portfolio_meta enable row level security;
alter table public.demo_portfolio_holdings enable row level security;
alter table public.demo_events enable row level security;
alter table public.demo_event_impacts enable row level security;
alter table public.demo_event_edges enable row level security;
alter table public.demo_stock_bars enable row level security;

drop policy if exists "Public read demo portfolio meta" on public.demo_portfolio_meta;
create policy "Public read demo portfolio meta"
  on public.demo_portfolio_meta for select
  using (true);

drop policy if exists "Public read demo portfolio holdings" on public.demo_portfolio_holdings;
create policy "Public read demo portfolio holdings"
  on public.demo_portfolio_holdings for select
  using (true);

drop policy if exists "Public read demo events" on public.demo_events;
create policy "Public read demo events"
  on public.demo_events for select
  using (true);

drop policy if exists "Public read demo event impacts" on public.demo_event_impacts;
create policy "Public read demo event impacts"
  on public.demo_event_impacts for select
  using (true);

drop policy if exists "Public read demo event edges" on public.demo_event_edges;
create policy "Public read demo event edges"
  on public.demo_event_edges for select
  using (true);

drop policy if exists "Public read demo stock bars" on public.demo_stock_bars;
create policy "Public read demo stock bars"
  on public.demo_stock_bars for select
  using (true);
