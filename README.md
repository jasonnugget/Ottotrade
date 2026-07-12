# Vercel + Supabase Deployment

Ottotrade ships as a frontend-only Vercel deployment backed by Supabase, plus one
serverless function for the AI analysis.

## What's where

- `frontend` — the app. No Express backend at runtime.
- `frontend/api/analyze.js` — Vercel serverless function; runs the Gemini call server-side
  so the API key never reaches the browser.
- `backend` — not deployed. It's the source of the curated event data, the tradable
  universe (`backend/src/universe.js`), and the cached Yahoo price data used to build the
  Supabase seed.

## 1. Create the schema

In the Supabase SQL Editor, run in this order:

1. `supabase/schema.sql` — base tables (profiles, demo event/price tables).
2. `supabase/migration-user-portfolio.sql` — **required.** Adds `demo_stocks` (the
   tradable universe) and `portfolio_lots` (per-user purchase lots, with RLS), and replaces
   the signup trigger.

Portfolios are now **per-user and lot-based**: each row in `portfolio_lots` is one purchase
(N shares at price P on date D). Cost basis, average cost per share, and P/L are all derived
from those lots — there is no hardcoded starting balance. New accounts are seeded with the
original demo positions as real dated lots; delete the INSERT block in the migration if you
want new users to start with an empty portfolio.

## 2. Fetch price data + generate the seed

```bash
node backend/scripts/fetchUniverse.js   # pulls 1d/1h/5m bars for every universe ticker
cd frontend && npm run seed:supabase    # writes supabase/seed.sql + seed-bars-*.sql
```

Then, in the SQL Editor, run **in this order**:

1. `supabase/seed.sql` (~12 KB) — stock catalog, events, impacts, event edges.
2. `supabase/seed-bars-1.sql`, `seed-bars-2.sql`, … — the price bars, in numeric order.

The bars are split across numbered files because a single seed exceeds the SQL Editor's size
limit. Only `seed-bars-1.sql` truncates `demo_stock_bars`; the rest append, so running them
out of order (or skipping one) leaves you with missing price history.

None of these touch `portfolio_lots` — that's user data.

Every ticker in `backend/src/universe.js` gets price bars, which is what makes it addable to
a portfolio. The universe is deliberately capped at 15 tickers: each one adds ~450 rows of
bars, and the seed gets too big for the SQL Editor if it grows much past that. To add one,
edit `universe.js`, re-run both commands above, and re-run the seed files.

## 3. Environment variables

Client (Vite, from `frontend/.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Server-only (set in the Vercel project settings, **not** prefixed with `VITE_`):

```env
GEMINI_API_KEY=your-gemini-api-key
# GEMINI_MODEL=gemini-3.5-flash   (optional override)
```

A `VITE_`-prefixed value is inlined into the public JS bundle. The Gemini key must never
carry that prefix.

## 4. Vercel settings

Project root `frontend`:

- Build command: `npm run build`
- Output directory: `dist`

## Local development

`npm run dev` (Vite) serves the app but **does not** run `frontend/api/*` functions — the
Analysis tab will fail against it. Use `vercel dev` from `frontend/` to exercise the
serverless function locally.
