// Resilient Yahoo Finance chart client.
// - Rotates between query1/query2 hosts
// - Retries with exponential backoff on 429 / network errors
// - Caches responses on disk (long TTL for fixed historical ranges, short for "live")
// - Provides point-in-time price via linear interpolation over hourly closes

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36';
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Seconds represented by each Yahoo interval label (used for interpolation & bucketing).
export const INTERVAL_SECONDS = {
  '1m': 60,
  '2m': 120,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '60m': 3600,
  '90m': 5400,
  '1h': 3600,
  '1d': 86400,
  '1wk': 604800,
  '1mo': 2592000,
};

function cacheFile(symbol, params) {
  const key = [
    symbol,
    params.interval,
    params.range || '',
    params.period1 || '',
    params.period2 || '',
  ]
    .join('_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(file, ttlMs) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (ttlMs > 0 && Date.now() - raw.fetchedAt > ttlMs) return null;
    return raw.data;
  } catch {
    return null;
  }
}

function writeCache(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch (e) {
    console.warn('cache write failed:', e.message);
  }
}

function buildUrl(host, symbol, params) {
  const qs = new URLSearchParams({ interval: params.interval, includePrePost: 'false' });
  if (params.range) qs.set('range', params.range);
  if (params.period1) qs.set('period1', String(params.period1));
  if (params.period2) qs.set('period2', String(params.period2));
  return `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?${qs.toString()}`;
}

function normalize(json) {
  const r = json?.chart?.result?.[0];
  if (!r) {
    const err = json?.chart?.error;
    throw new Error(err ? `${err.code}: ${err.description}` : 'no chart result');
  }
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const adj = r.indicators?.adjclose?.[0]?.adjclose;
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close?.[i];
    if (close == null) continue; // skip gaps (holidays/halts)
    bars.push({
      t: ts[i],
      open: q.open?.[i] ?? close,
      high: q.high?.[i] ?? close,
      low: q.low?.[i] ?? close,
      close,
      adjclose: adj?.[i] ?? close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  const m = r.meta || {};
  return {
    symbol: m.symbol,
    currency: m.currency,
    interval: m.dataGranularity,
    regularMarketPrice: m.regularMarketPrice,
    previousClose: m.chartPreviousClose ?? m.previousClose,
    regularMarketTime: m.regularMarketTime, // unix seconds of last trade
    marketState: m.marketState, // PRE / REGULAR / POST / CLOSED
    exchangeTimezone: m.exchangeTimezoneName,
    bars,
  };
}

// Fetch a normalized chart. `ttlMs`=0 means cache forever (good for fixed historical ranges).
export async function getChart(symbol, params, { ttlMs = 0, maxAttempts = 6 } = {}) {
  const file = cacheFile(symbol, params);
  const cached = readCache(file, ttlMs);
  if (cached) return cached;

  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      const res = await fetch(buildUrl(host, symbol, params), {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`${res.status} rate-limited`);
      } else if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        const json = await res.json();
        const data = normalize(json);
        writeCache(file, data);
        return data;
      }
    } catch (e) {
      lastErr = e;
    }
    // backoff: 0.8s, 1.6s, 2.4s ... with a little jitter
    await sleep(800 * (attempt + 1) + Math.floor(Math.random() * 300));
  }
  // Last resort: serve stale cache if we have any.
  const stale = readCache(file, 0);
  if (stale) {
    console.warn(`serving STALE cache for ${symbol} after failures: ${lastErr?.message}`);
    return stale;
  }
  throw new Error(`Yahoo fetch failed for ${symbol}: ${lastErr?.message}`);
}

// Real-time-ish quote for a single symbol. Uses a tiny recent chart so we also get the
// latest intraday bar. Short TTL keeps it "live" without hammering Yahoo.
export async function getQuote(symbol, { ttlMs = 20 * 1000 } = {}) {
  const chart = await getChart(symbol, { interval: '1m', range: '1d' }, { ttlMs });
  const lastBar = chart.bars[chart.bars.length - 1];
  const price = chart.regularMarketPrice ?? lastBar?.close;
  return {
    symbol: chart.symbol || symbol.toUpperCase(),
    price,
    previousClose: chart.previousClose,
    change: price != null && chart.previousClose != null ? price - chart.previousClose : null,
    changePct:
      price != null && chart.previousClose
        ? (price - chart.previousClose) / chart.previousClose
        : null,
    marketState: chart.marketState,
    time: chart.regularMarketTime ?? lastBar?.t ?? Math.floor(Date.now() / 1000),
    intradayBars: chart.bars, // 1-minute bars for today's chart
  };
}

// Point-in-time price at a unix timestamp using linear interpolation over hourly closes.
// Each bar's close is treated as the price at (bar start + interval). We interpolate between
// the two surrounding close points, so an 11:00 target between the 10:30 and 11:30 bars is
// a true mid-point estimate rather than snapping to a bar edge.
export async function getPriceAt(symbol, targetTs, { windowDays = 5 } = {}) {
  const period1 = targetTs - windowDays * 86400;
  const period2 = targetTs + windowDays * 86400;
  const chart = await getChart(symbol, { interval: '1h', period1, period2 }, { ttlMs: 0 });
  const iv = INTERVAL_SECONDS['1h'];
  // points: [closeTime, price]
  const pts = chart.bars.map((b) => [b.t + iv, b.close]);
  if (pts.length === 0) throw new Error(`no bars for ${symbol} near ${targetTs}`);

  // Also add the first bar's open at its start so targets before the first close still interpolate.
  pts.unshift([chart.bars[0].t, chart.bars[0].open]);
  pts.sort((a, b) => a[0] - b[0]);

  if (targetTs <= pts[0][0]) return { price: pts[0][1], method: 'clamp-first', asOf: pts[0][0] };
  const last = pts[pts.length - 1];
  if (targetTs >= last[0]) return { price: last[1], method: 'clamp-last', asOf: last[0] };

  for (let i = 1; i < pts.length; i++) {
    const [t1, p1] = pts[i - 1];
    const [t2, p2] = pts[i];
    if (targetTs >= t1 && targetTs <= t2) {
      const frac = t2 === t1 ? 0 : (targetTs - t1) / (t2 - t1);
      return { price: p1 + (p2 - p1) * frac, method: 'interp', asOf: targetTs, lo: p1, hi: p2 };
    }
  }
  return { price: last[1], method: 'clamp-last', asOf: last[0] };
}
