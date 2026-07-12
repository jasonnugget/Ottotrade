import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { META } from '../backend/src/config.js';
import { EVENTS } from '../backend/src/events/seed.js';
import { UNIVERSE, UNIVERSE_SYMBOLS } from '../backend/src/universe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(repoRoot, 'backend', 'cache');
const outputFile = path.join(repoRoot, 'supabase', 'seed.sql');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function latestMatchingFile(prefix, pickLongestBars = false) {
  const files = fs.readdirSync(cacheDir).filter((name) => name.startsWith(prefix));
  if (!files.length) throw new Error(`No cache files found for ${prefix}`);

  if (pickLongestBars) {
    return files
      .map((name) => {
        const full = path.join(cacheDir, name);
        const bars = readJson(full).data?.bars || [];
        return { name, full, bars: bars.length, fetchedAt: readJson(full).fetchedAt || 0 };
      })
      .sort((a, b) => b.bars - a.bars || b.fetchedAt - a.fetchedAt)[0].full;
  }

  return files
    .map((name) => {
      const full = path.join(cacheDir, name);
      const json = readJson(full);
      return { full, fetchedAt: json.fetchedAt || 0 };
    })
    .sort((a, b) => b.fetchedAt - a.fetchedAt)[0].full;
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function num(value) {
  return value == null ? 'null' : String(value);
}

function isoFromTs(ts) {
  return new Date(ts * 1000).toISOString();
}

function pgArray(values) {
  if (!values || !values.length) return "'{}'";
  return `'{${values.map((v) => String(v).replace(/"/g, '\\"').replace(/,/g, '\\,')).join(',')}}'`;
}

function keywords(event) {
  return new Set(
    `${event.headline} ${event.category}`
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
}

function similarity(a, b) {
  let score = a.category === b.category ? 0.5 : 0;
  const ka = keywords(a);
  const kb = keywords(b);
  let overlap = 0;
  for (const word of ka) if (kb.has(word)) overlap += 1;
  const denom = Math.max(1, Math.min(ka.size, kb.size));
  score += 0.5 * (overlap / denom);
  return Math.min(1, score);
}

// Bars are seeded for the whole tradable universe, not just the original 7 — a user can
// add any of these to their portfolio, and an unpriceable holding is a broken holding.
const symbols = UNIVERSE_SYMBOLS;
const dailyBySymbol = {};
const intradayBySymbol = {};

for (const symbol of symbols) {
  // yahoo.js strips non-alphanumerics when building its cache filename, so BRK-B is
  // cached as BRKB_… — match that here or the lookup misses.
  const cacheKey = symbol.replace(/[^a-zA-Z0-9_]/g, '');
  const dailyPath = latestMatchingFile(`${cacheKey}_1d__`, true);
  const intradayPath = latestMatchingFile(`${cacheKey}_5m_1d__`);

  dailyBySymbol[symbol] = readJson(dailyPath).data.bars;
  intradayBySymbol[symbol] = readJson(intradayPath).data.bars;
}

function priceReaction(ticker, eventDate) {
  const bars = dailyBySymbol[ticker].map((bar) => ({
    ...bar,
    date: new Date(bar.t * 1000).toISOString().slice(0, 10),
  }));
  const day = eventDate.slice(0, 10);
  let idx = bars.findIndex((bar) => bar.date >= day);
  if (idx === -1) idx = bars.length - 1;
  if (idx <= 0) return null;
  const cur = bars[idx];
  const prev = bars[idx - 1];
  const pct = ((cur.close - prev.close) / prev.close) * 100;
  return {
    reaction_date: cur.date,
    price: cur.close,
    pct_change: pct,
  };
}

const enrichedEvents = EVENTS.map((event) => {
  const impacts = event.impacts.map((impact) => {
    const rx = priceReaction(impact.ticker, event.date);
    return {
      ...impact,
      pct_change: rx?.pct_change ?? null,
      price: rx?.price ?? null,
      reaction_date: rx?.reaction_date ?? null,
    };
  });
  const magnitude = impacts.reduce(
    (max, impact) => (impact.pct_change == null ? max : Math.max(max, Math.abs(impact.pct_change))),
    0
  );
  const confidence =
    impacts.find((impact) => impact.tier === 'direct')?.tier ||
    impacts.find((impact) => impact.tier === 'indirect')?.tier ||
    impacts[0]?.tier ||
    'unrelated';
  return {
    ...event,
    ts: Math.floor(new Date(event.date).getTime() / 1000),
    magnitude,
    confidence_tier: confidence,
    impacts,
  };
}).sort((a, b) => a.ts - b.ts);

const eventEdges = [];
const seenEdges = new Set();
for (const event of enrichedEvents) {
  const related = new Set(event.related_event_ids || []);
  for (const other of enrichedEvents) {
    if (other.id === event.id) continue;
    const key = [event.id, other.id].sort().join('|');
    if (seenEdges.has(key)) continue;
    const declared = related.has(other.id) || (other.related_event_ids || []).includes(event.id);
    const sim = similarity(event, other);
    if (declared || sim >= 0.75) {
      seenEdges.add(key);
      eventEdges.push({
        source: event.id,
        target: other.id,
        weight: declared ? Math.max(sim, 0.6) : sim,
        declared,
      });
    }
  }
}

const lines = [];

lines.push('-- Generated by scripts/generate-supabase-seed.mjs');
lines.push('-- Run after supabase/schema.sql');
lines.push('');
// portfolio_lots is user data — never truncated here. Only the public reference tables are.
lines.push('truncate table public.demo_event_edges restart identity cascade;');
lines.push('truncate table public.demo_event_impacts restart identity cascade;');
lines.push('truncate table public.demo_events restart identity cascade;');
lines.push('truncate table public.demo_stock_bars restart identity cascade;');
lines.push('truncate table public.demo_portfolio_meta restart identity cascade;');
lines.push('');

lines.push(
  `insert into public.demo_portfolio_meta (id, capital, purchase_date, purchase_ts, snapshot_date, snapshot_ts, snapshot_hour_est) values (${esc('default')}, ${num(META.capital)}, ${esc(META.purchase.date)}, ${esc(isoFromTs(META.purchase.ts))}, ${esc(META.snapshot.date)}, ${esc(isoFromTs(META.snapshot.ts))}, ${num(META.snapshot.hourEst)})`
);
lines.push('  on conflict (id) do update set capital = excluded.capital, purchase_date = excluded.purchase_date, purchase_ts = excluded.purchase_ts, snapshot_date = excluded.snapshot_date, snapshot_ts = excluded.snapshot_ts, snapshot_hour_est = excluded.snapshot_hour_est;');
lines.push('');

// The tradable universe. portfolio_lots.ticker references this, so it must be upserted
// rather than truncated — deleting a row a user holds a lot of would break their portfolio.
lines.push('insert into public.demo_stocks (ticker, company, sector) values');
lines.push(
  symbols
    .map((symbol) => `  (${esc(symbol)}, ${esc(UNIVERSE[symbol].name)}, ${esc(UNIVERSE[symbol].sector)})`)
    .join(',\n') +
    '\n  on conflict (ticker) do update set company = excluded.company, sector = excluded.sector;'
);
lines.push('');

lines.push('insert into public.demo_events (id, event_date, headline, category, location_lat, location_lon, location_name, source_outlet, source_url, source_published_at, source_updated_at, related_event_ids, confidence_tier, magnitude) values');
lines.push(
  enrichedEvents
    .map(
      (event) =>
        `  (${esc(event.id)}, ${esc(new Date(event.date).toISOString())}, ${esc(event.headline)}, ${esc(event.category)}, ${num(event.location?.lat)}, ${num(event.location?.lon)}, ${esc(event.location?.name)}, ${esc(event.source?.outlet)}, ${esc(event.source?.url)}, ${esc(event.source?.published_at ? new Date(event.source.published_at).toISOString() : null)}, ${esc(event.source?.updated_at ? new Date(event.source.updated_at).toISOString() : null)}, ${pgArray(event.related_event_ids || [])}, ${esc(event.confidence_tier)}, ${num(event.magnitude)})`
    )
    .join(',\n') + ';'
);
lines.push('');

lines.push('insert into public.demo_event_impacts (event_id, ticker, tier, direction, reasoning, pct_change, price, reaction_date) values');
lines.push(
  enrichedEvents
    .flatMap((event) =>
      event.impacts.map(
        (impact) =>
          `  (${esc(event.id)}, ${esc(impact.ticker)}, ${esc(impact.tier)}, ${esc(impact.direction)}, ${esc(impact.reasoning)}, ${num(impact.pct_change)}, ${num(impact.price)}, ${esc(impact.reaction_date)})`
      )
    )
    .join(',\n') + ';'
);
lines.push('');

lines.push('insert into public.demo_event_edges (source_event_id, target_event_id, weight, declared) values');
lines.push(
  eventEdges
    .map(
      (edge) =>
        `  (${esc(edge.source)}, ${esc(edge.target)}, ${num(edge.weight)}, ${edge.declared ? 'true' : 'false'})`
    )
    .join(',\n') + ';'
);
lines.push('');

const barRows = [];
for (const symbol of symbols) {
  for (const bar of dailyBySymbol[symbol]) {
    barRows.push(
      `  (${esc(symbol)}, ${esc('1d')}, ${esc(isoFromTs(bar.t))}, ${num(bar.open)}, ${num(bar.high)}, ${num(bar.low)}, ${num(bar.close)}, ${num(bar.adjclose)}, ${num(bar.volume)})`
    );
  }
  for (const bar of intradayBySymbol[symbol]) {
    barRows.push(
      `  (${esc(symbol)}, ${esc('5m')}, ${esc(isoFromTs(bar.t))}, ${num(bar.open)}, ${num(bar.high)}, ${num(bar.low)}, ${num(bar.close)}, ${num(bar.adjclose)}, ${num(bar.volume)})`
    );
  }
}

lines.push('insert into public.demo_stock_bars (ticker, interval, bar_ts, open, high, low, close, adjclose, volume) values');
lines.push(barRows.join(',\n') + ';');
lines.push('');

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, lines.join('\n'));
console.log(`Wrote ${outputFile}`);
