// Thin API client + formatting helpers.

async function get(path) {
  const res = await fetch(path);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  meta: () => get('/api/meta'),
  summary: () => get('/api/summary'),
  pl: () => get('/api/pl'),
  live: () => get('/api/live'),
  quotes: () => get('/api/quotes'),
  events: () => get('/api/events'),
  graph: (until) => get(`/api/graph${until ? `?until=${encodeURIComponent(until)}` : ''}`),
  timeline: () => get('/api/timeline'),
  stocks: () => get('/api/stocks'),
  enrichStatus: () => get('/api/enrichment/status'),
  enrich: (id) => get(`/api/enrich/${id}`),
  stockHistory: (symbol, timeframe) =>
    get(`/api/stocks/${symbol}/history?timeframe=${encodeURIComponent(timeframe)}`),
};

export const usd = (n) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const usd0 = (n) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const pct = (n) => (n == null ? '—' : `${(n * 100).toFixed(2)}%`);

export const signedUsd = (n) => (n >= 0 ? `+${usd(n)}` : `-${usd(Math.abs(n))}`);
export const signedPct = (n) => (n >= 0 ? `+${pct(n)}` : pct(n));

export const plClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat');

export const fmtShares = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
