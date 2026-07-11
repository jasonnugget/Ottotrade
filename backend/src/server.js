import express from 'express';
import cors from 'cors';
import { META } from './config.js';
import {
  fullSummary,
  snapshotAt,
  plTracker,
  liveTracker,
  getLiveQuotes,
  stockHistory,
  timeframeList,
  getHoldings,
} from './portfolio.js';
import { PURCHASE_TS, SNAPSHOT_TS } from './config.js';
import { getEvents, buildGraph, getTimeline } from './events.js';
import { STOCKS } from './events/seed.js';
import { enrichEvent, enrichmentAvailable } from './enrich.js';

const app = express();
app.use(cors());

// Small helper so route errors return JSON instead of crashing.
const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    console.error(`[${req.path}]`, e.message);
    res.status(502).json({ error: e.message });
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/meta', (_req, res) => res.json({ ...META, timeframes: timeframeList() }));

// One-shot payload for the dashboard.
app.get('/api/summary', wrap(() => fullSummary()));

app.get('/api/holdings', wrap(() => getHoldings()));

// Purchase-time portfolio (Feb 23, 11:00 EST).
app.get('/api/portfolio/purchase', wrap(() => snapshotAt(PURCHASE_TS)));

// Updated portfolio at the Mar 2, 11:00 EST snapshot.
app.get('/api/portfolio/snapshot', wrap(() => snapshotAt(SNAPSHOT_TS)));

// Value the portfolio at an arbitrary unix timestamp (?ts=...).
app.get(
  '/api/portfolio/at',
  wrap((req) => snapshotAt(Number(req.query.ts)))
);

// Overall P/L tracker with day/week/month/year windows (daily-close based).
app.get('/api/pl', wrap(() => plTracker()));

// Real-time P/L tracker: live current value, day change vs previous close. Poll this.
app.get('/api/live', wrap(() => liveTracker()));

// Just the live per-symbol quotes.
app.get('/api/quotes', wrap(() => getLiveQuotes()));

// Per-stock price history with timeframe handling: /api/stocks/AAPL/history?timeframe=1M
app.get(
  '/api/stocks/:symbol/history',
  wrap((req) => stockHistory(req.params.symbol, req.query.timeframe || 'SINCE'))
);

// ---- Bubble map: events, graph, timeline ----

app.get('/api/stocks', (_req, res) => res.json(STOCKS));

// All events with computed price reactions + confidence tiers + reasoning.
app.get('/api/events', wrap(() => getEvents()));

// The connection web: nodes + edges, optionally revealed up to ?until=<unix or ISO>.
app.get(
  '/api/graph',
  wrap((req) => {
    const u = req.query.until;
    let untilTs = Infinity;
    if (u) untilTs = /^\d+$/.test(u) ? Number(u) : Math.floor(new Date(u).getTime() / 1000);
    return buildGraph(untilTs);
  })
);

// Timeline spine: daily portfolio value + event markers for the scrubber.
app.get('/api/timeline', wrap(() => getTimeline()));

// Live AI reasoning via Gemini for one event (falls back to curated when no key).
app.get('/api/enrichment/status', (_req, res) =>
  res.json({ available: enrichmentAvailable(), provider: 'gemini' })
);
app.get(
  '/api/enrich/:id',
  wrap(async (req) => {
    const events = await getEvents();
    const ev = events.find((e) => e.id === req.params.id);
    if (!ev) throw new Error(`unknown event ${req.params.id}`);
    const ai = await enrichEvent(ev);
    return { id: ev.id, headline: ev.headline, curated: ev.impacts, ai };
  })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Portfolio backend listening on http://localhost:${PORT}`);
  console.log(`  purchase ts=${PURCHASE_TS} (${new Date(PURCHASE_TS * 1000).toISOString()})`);
  console.log(`  snapshot ts=${SNAPSHOT_TS} (${new Date(SNAPSHOT_TS * 1000).toISOString()})`);
});
