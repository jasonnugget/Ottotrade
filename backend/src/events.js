// Event/graph engine: attaches real price reactions to seed events, and builds the
// node/edge graph + timeline that the bubble-map frontend consumes.

import { EVENTS, STOCKS } from './events/seed.js';
import { getChart } from './yahoo.js';
import { getHoldings, snapshotAt } from './portfolio.js';

const DAY = 86400;
const SYMS = Object.keys(STOCKS);
const WINDOW_START = Math.floor(Date.UTC(2026, 1, 1) / 1000); // Feb 1 2026

const dailyCache = {}; // ticker -> bars

async function dailyBars(ticker) {
  if (dailyCache[ticker]) return dailyCache[ticker];
  const now = Math.floor(Date.now() / 1000);
  const chart = await getChart(
    ticker,
    { interval: '1d', period1: WINDOW_START, period2: now },
    { ttlMs: 30 * 60 * 1000 }
  );
  // index by ET date string
  const bars = chart.bars.map((b) => ({
    ...b,
    date: new Date(b.t * 1000).toISOString().slice(0, 10),
  }));
  dailyCache[ticker] = bars;
  return bars;
}

// Real daily price reaction for a ticker on/after an event date: close vs prior close.
async function priceReaction(ticker, eventDate) {
  const bars = await dailyBars(ticker);
  const day = eventDate.slice(0, 10);
  let idx = bars.findIndex((b) => b.date >= day);
  if (idx === -1) idx = bars.length - 1; // event after last bar -> use last
  if (idx <= 0) return null;
  const cur = bars[idx];
  const prev = bars[idx - 1];
  const pct = ((cur.close - prev.close) / prev.close) * 100;
  return {
    ticker,
    timestamp: cur.t,
    date: cur.date,
    price: cur.close,
    prevClose: prev.close,
    pct_change: pct,
  };
}

// Load events with computed reactions merged onto each impact.
let _enriched = null;
export async function getEvents() {
  if (_enriched) return _enriched;
  const out = [];
  for (const ev of EVENTS) {
    const impacts = [];
    for (const im of ev.impacts) {
      const rx = await priceReaction(im.ticker, ev.date);
      impacts.push({
        ...im,
        pct_change: rx ? rx.pct_change : null,
        price: rx ? rx.price : null,
        reaction_date: rx ? rx.date : null,
      });
    }
    // magnitude = largest absolute realized move among affected tickers (drives bubble size)
    const magnitude = impacts.reduce(
      (m, i) => (i.pct_change != null ? Math.max(m, Math.abs(i.pct_change)) : m),
      0
    );
    const dominantTier =
      impacts.find((i) => i.tier === 'direct')?.tier ||
      impacts.find((i) => i.tier === 'indirect')?.tier ||
      impacts[0]?.tier ||
      'unrelated';
    out.push({
      ...ev,
      ts: Math.floor(new Date(ev.date).getTime() / 1000),
      affected_tickers: ev.impacts.map((i) => i.ticker),
      confidence_tier: dominantTier,
      magnitude,
      impacts,
    });
  }
  out.sort((a, b) => a.ts - b.ts);
  _enriched = out;
  return out;
}

// Keyword overlap for event-event similarity (upgradeable to embeddings later).
function keywords(ev) {
  return new Set(
    (ev.headline + ' ' + ev.category)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function similarity(a, b) {
  let score = a.category === b.category ? 0.5 : 0;
  const ka = keywords(a);
  const kb = keywords(b);
  let overlap = 0;
  for (const w of ka) if (kb.has(w)) overlap++;
  const denom = Math.max(1, Math.min(ka.size, kb.size));
  score += 0.5 * (overlap / denom);
  return Math.min(1, score);
}

// Build the graph (nodes + edges) up to an optional `untilTs`.
export async function buildGraph(untilTs = Infinity) {
  const events = (await getEvents()).filter((e) => e.ts <= untilTs);

  const nodes = [];
  // Stock nodes (always present).
  for (const sym of SYMS) {
    nodes.push({
      id: sym,
      type: 'stock',
      label: sym,
      name: STOCKS[sym].name,
      sector: STOCKS[sym].sector,
    });
  }
  // Event nodes.
  for (const ev of events) {
    nodes.push({
      id: ev.id,
      type: 'event',
      label: ev.headline,
      category: ev.category,
      date: ev.date,
      ts: ev.ts,
      location: ev.location,
      magnitude: ev.magnitude,
      tier: ev.confidence_tier,
    });
  }

  const edges = [];
  // Event -> Stock edges, one per impact, carrying the per-ticker tier.
  for (const ev of events) {
    for (const im of ev.impacts) {
      edges.push({
        id: `${ev.id}->${im.ticker}`,
        source: ev.id,
        target: im.ticker,
        kind: 'event-stock',
        tier: im.tier,
        direction: im.direction,
        pct_change: im.pct_change,
        reasoning: im.reasoning,
      });
    }
  }
  // Event -> Event similarity edges (dedup + only among visible events).
  const visible = new Set(events.map((e) => e.id));
  const seen = new Set();
  for (const ev of events) {
    const related = new Set(ev.related_event_ids || []);
    for (const other of events) {
      if (other.id === ev.id) continue;
      const key = [ev.id, other.id].sort().join('|');
      if (seen.has(key)) continue;
      const declared = related.has(other.id) || (other.related_event_ids || []).includes(ev.id);
      const sim = similarity(ev, other);
      if (declared || sim >= 0.75) {
        if (!visible.has(other.id)) continue;
        seen.add(key);
        edges.push({
          id: `sim:${key}`,
          source: ev.id,
          target: other.id,
          kind: 'event-event',
          weight: declared ? Math.max(sim, 0.6) : sim,
          declared,
        });
      }
    }
  }

  return { nodes, edges, eventCount: events.length };
}

// Timeline: daily portfolio value across the Feb–Jul window + event markers.
export async function getTimeline() {
  await getHoldings();
  const events = await getEvents();
  const now = Math.floor(Date.now() / 1000);
  const bars = await dailyBars(SYMS[0]); // AAPL calendar as the date spine
  const holdings = await getHoldings();

  // Build a per-date portfolio value using each ticker's daily close (forward-filled).
  const perTicker = {};
  for (const s of SYMS) perTicker[s] = await dailyBars(s);
  const lastClose = {};

  const points = [];
  for (const bar of bars) {
    let value = 0;
    let ok = true;
    for (const s of SYMS) {
      const b = perTicker[s].find((x) => x.date === bar.date);
      if (b) lastClose[s] = b.close;
      if (lastClose[s] == null) ok = false;
      else value += holdings[s].shares * lastClose[s];
    }
    if (ok) points.push({ date: bar.date, ts: bar.t, value });
  }

  const markers = events.map((e) => ({
    id: e.id,
    ts: e.ts,
    date: e.date.slice(0, 10),
    headline: e.headline,
    tier: e.confidence_tier,
    category: e.category,
    magnitude: e.magnitude,
  }));

  return { points, markers, start: points[0]?.ts, end: points[points.length - 1]?.ts, now };
}
