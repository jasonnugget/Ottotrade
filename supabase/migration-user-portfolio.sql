-- Per-user, lot-based portfolios.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR (after schema.sql), then run the regenerated seed.sql.
--
-- What changes and why:
--   Before, every user saw the same hardcoded $50,000 / 7-stock allocation baked into
--   demo_portfolio_holdings + demo_portfolio_meta.capital. A portfolio you can add to and
--   sell out of cannot work that way: cost basis, average cost per share, and P/L all have
--   to be derived from what the user actually bought and when.
--
--   So holdings become LOTS. Each row is one purchase: N shares of X at price P on date D.
--   Buying more of the same ticker adds another lot rather than overwriting the old one,
--   which is what makes a true average cost per share (and a correct cost basis) possible.

-- The tradable universe. Populated by seed.sql from backend/src/universe.js — the frontend
-- uses this to know which tickers can be added and how to label them.
create table if not exists public.demo_stocks (
  ticker text primary key,
  company text not null,
  sector text not null
);

alter table public.demo_stocks enable row level security;

drop policy if exists "Public read demo stocks" on public.demo_stocks;
create policy "Public read demo stocks"
  on public.demo_stocks for select
  using (true);

-- One row per purchase lot.
create table if not exists public.portfolio_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null references public.demo_stocks(ticker),
  shares numeric not null check (shares > 0),
  buy_price numeric not null check (buy_price > 0),
  purchase_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_lots_user_idx on public.portfolio_lots (user_id);
create index if not exists portfolio_lots_user_ticker_idx on public.portfolio_lots (user_id, ticker);

alter table public.portfolio_lots enable row level security;

-- A user can only ever see or touch their own lots.
drop policy if exists "Users can view their own lots" on public.portfolio_lots;
create policy "Users can view their own lots"
  on public.portfolio_lots for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own lots" on public.portfolio_lots;
create policy "Users can insert their own lots"
  on public.portfolio_lots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own lots" on public.portfolio_lots;
create policy "Users can update their own lots"
  on public.portfolio_lots for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own lots" on public.portfolio_lots;
create policy "Users can delete their own lots"
  on public.portfolio_lots for delete
  using (auth.uid() = user_id);

-- Replace the old signup trigger. The previous one inserted a fixed $50k / 7-stock
-- allocation into portfolio_holdings for every new user. New users now start with a
-- COMPLETELY EMPTY portfolio and build it themselves from the Add stock button — the
-- signup trigger only creates their profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Starting over: wipe every existing portfolio so current accounts also begin empty,
-- matching what a brand-new signup now sees. Comment this out if you'd rather keep any
-- lots that already exist.
delete from public.portfolio_lots;

-- The old fixed-allocation table is superseded by portfolio_lots. Left in place rather than
-- dropped so existing data isn't destroyed; nothing reads it anymore.
-- To remove it once you're satisfied:  drop table public.portfolio_holdings;
