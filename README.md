# Vercel + Supabase Deployment

The current portfolio can now ship as a frontend-only Vercel deployment backed by Supabase.

## What changed

- `frontend` no longer needs the Express backend at runtime.
- The frontend reads public `demo_*` tables from Supabase directly.
- The `backend` folder remains the source of the curated event data and cached market data used to generate the Supabase seed.

## 1. Create the Supabase schema

Run [supabase/schema.sql](/Users/jasonnguyen/Desktop/placeholder/supabase/schema.sql:1) in the Supabase SQL Editor.

That file includes:

- future auth-oriented tables for login work later
- public demo tables used by the live portfolio now

## 2. Generate the seed SQL

From [frontend/package.json](/Users/rei/Ottotrade/frontend/package.json:1):

```bash
npm run seed:supabase
```

This writes:

- [supabase/seed.sql](/Users/jasonnguyen/Desktop/placeholder/supabase/seed.sql:1)

Run `supabase/seed.sql` in the Supabase SQL Editor after the schema.

The seed is generated from:

- curated event data in `backend/src/events/seed.js`
- cached price data in `backend/cache`

So Vercel does not need the Node server or live Yahoo calls.

## 3. Set Vercel environment variables

Use [frontend/.env.example](/Users/rei/Ottotrade/frontend/.env.example:1) as the template:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Vercel settings

If your Vercel project root is `frontend`, use:

- Build command: `npm run build`
- Output directory: `dist`

## Current deployment behavior

- Portfolio data, charts, event graph, and timeline come from Supabase.
- The frontend no longer calls `/api/*`.
- AI event enrichment is disabled in this frontend-only deployment.
- Login can be layered on later without restoring the Express runtime.
