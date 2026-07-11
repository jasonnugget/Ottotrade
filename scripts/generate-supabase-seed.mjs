import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { CAPITAL, META, PURCHASE_TS, SNAPSHOT_TS } from '../backend/src/config.js';
import { EVENTS, STOCKS } from '../backend/src/events/seed.js';

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

function interpPrice(hourlyBars, targetTs) {
  const iv = 3600;
  const pts = hourlyBars.map((bar) => [bar.t + iv, bar.close]);
  pts.unshift([hourlyBars[0].t, hourlyBars[0].open]);
  pts.sort((a, b) => a[0] - b[0]);

  if (targetTs <= pts[0][0]) return { price: pts[0][1], method: 'clamp-first' };
  if (targetTs >= pts[pts.length - 1][0]) return { price: pts[pts.length - 1][1], method: 'clamp-last' };

  for (let i = 1; i < pts.length; i++) {
    const [t1, p1] = pts[i - 1];
    const [t2, p2] = pts[i];
    if (targetTs >= t1 && targetTs <= t2) {
      const frac = t2 === t1 ? 0 : (targetTs - t1) / (t2 - t1);
      return { price: p1 + (p2 - p1) * frac, method: 'interp' };
    }
  }

  return { price: pts[pts.length - 1][1], method: 'clamp-last' };
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

const symbols = Object.keys(STOCKS);
const holdings = [];
const dailyBySymbol = {};
const intradayBySymbol = {};

for (const symbol of symbols) {
  const dailyPath = latestMatchingFile(`${symbol}_1d__`, true);
  const hourlyPath = latestMatchingFile(`${symbol}_1h__`, true);
  const intradayPath = latestMatchingFile(`${symbol}_5m_1d__`);

  const daily = readJson(dailyPath).data.bars;
  const hourly = readJson(hourlyPath).data.bars;
  const intraday = readJson(intradayPath).data.bars;

  dailyBySymbol[symbol] = daily;
  intradayBySymbol[symbol] = intraday;

  const buy = interpPrice(hourly, PURCHASE_TS);
  const snapshot = interpPrice(hourly, SNAPSHOT_TS);
  const allocationUsd = STOCKS[symbol].allocation;
  holdings.push({
    ticker: symbol,
    company: STOCKS[symbol].name,
    sector: STOCKS[symbol].sector,
    allocation_usd: allocationUsd,
    allocation_pct: (allocationUsd / CAPITAL) * 100,
    buy_price: buy.price,
    buy_price_method: buy.method,
    snapshot_price: snapshot.price,
    snapshot_price_method: snapshot.method,
    shares: allocationUsd / buy.price,
  });
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
lines.push('truncate table public.demo_event_edges restart identity cascade;');
lines.push('truncate table public.demo_event_impacts restart identity cascade;');
lines.push('truncate table public.demo_events restart identity cascade;');
lines.push('truncate table public.demo_stock_bars restart identity cascade;');
lines.push('truncate table public.demo_portfolio_holdings restart identity cascade;');
lines.push('truncate table public.demo_portfolio_meta restart identity cascade;');
lines.push('');

lines.push(
  `insert into public.demo_portfolio_meta (id, capital, purchase_date, purchase_ts, snapshot_date, snapshot_ts, snapshot_hour_est) values (${esc('default')}, ${num(META.capital)}, ${esc(META.purchase.date)}, ${esc(isoFromTs(META.purchase.ts))}, ${esc(META.snapshot.date)}, ${esc(isoFromTs(META.snapshot.ts))}, ${num(META.snapshot.hourEst)});`
);
lines.push('');

lines.push('insert into public.demo_portfolio_holdings (ticker, company, sector, allocation_usd, allocation_pct, buy_price, buy_price_method, snapshot_price, snapshot_price_method, shares) values');
lines.push(
  holdings
    .map(
      (holding) =>
        `  (${esc(holding.ticker)}, ${esc(holding.company)}, ${esc(holding.sector)}, ${num(holding.allocation_usd)}, ${num(holding.allocation_pct)}, ${num(holding.buy_price)}, ${esc(holding.buy_price_method)}, ${num(holding.snapshot_price)}, ${esc(holding.snapshot_price_method)}, ${num(holding.shares)})`
    )
    .join(',\n') + ';'
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
