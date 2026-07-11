// Portfolio math: holdings from purchase-time prices, snapshots, P/L windows, per-stock history.

import {
  CAPITAL,
  ALLOCATION,
  SYMBOLS,
  PURCHASE_TS,
  SNAPSHOT_TS,
  META,
} from './config.js';
import { getChart, getPriceAt, getQuote } from './yahoo.js';

const DAY = 86400;

let _holdings = null; // memoized

// Compute shares bought at the purchase timestamp for each symbol.
export async function getHoldings() {
  if (_holdings) return _holdings;
  const holdings = {};
  for (const sym of SYMBOLS) {
    const weight = ALLOCATION[sym];
    const dollars = CAPITAL * weight;
    const { price: buyPrice, method } = await getPriceAt(sym, PURCHASE_TS);
    holdings[sym] = {
      symbol: sym,
      weight,
      dollarsAllocated: dollars,
      buyPrice,
      buyPriceMethod: method,
      shares: dollars / buyPrice,
    };
  }
  _holdings = holdings;
  return holdings;
}

// Value each holding at a given timestamp.
export async function snapshotAt(ts) {
  const holdings = await getHoldings();
  const positions = [];
  let totalValue = 0;
  let totalCost = 0;
  for (const sym of SYMBOLS) {
    const h = holdings[sym];
    const { price, method } = await getPriceAt(sym, ts);
    const value = h.shares * price;
    const cost = h.dollarsAllocated;
    totalValue += value;
    totalCost += cost;
    positions.push({
      symbol: sym,
      weight: h.weight,
      shares: h.shares,
      buyPrice: h.buyPrice,
      price,
      priceMethod: method,
      cost,
      value,
      pl: value - cost,
      plPct: (value - cost) / cost,
    });
  }
  return {
    ts,
    totalCost,
    totalValue,
    pl: totalValue - totalCost,
    plPct: (totalValue - totalCost) / totalCost,
    positions,
  };
}

// Build a daily portfolio-value time series using current holdings x daily closes.
// Covers >=1y so day/week/month/year windows all resolve.
async function dailySeries() {
  const holdings = await getHoldings();
  const now = Math.floor(Date.now() / 1000);
  const period1 = Math.min(PURCHASE_TS, now - 400 * DAY); // >13 months back
  const bySym = {};
  for (const sym of SYMBOLS) {
    const chart = await getChart(
      sym,
      { interval: '1d', period1, period2: now },
      { ttlMs: 10 * 60 * 1000 }
    );
    bySym[sym] = chart.bars;
  }
  // Union of all trading-day timestamps (normalize to date string to align across symbols).
  const dateMap = new Map(); // dateKey -> { ts, closes: {sym:close} }
  for (const sym of SYMBOLS) {
    for (const b of bySym[sym]) {
      const dateKey = new Date(b.t * 1000).toISOString().slice(0, 10);
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, { ts: b.t, closes: {} });
      dateMap.get(dateKey).closes[sym] = b.close;
    }
  }
  const days = [...dateMap.entries()].sort((a, b) => a[1].ts - b[1].ts);
  const series = [];
  const lastClose = {};
  for (const [dateKey, { ts, closes }] of days) {
    let value = 0;
    let complete = true;
    for (const sym of SYMBOLS) {
      if (closes[sym] != null) lastClose[sym] = closes[sym];
      if (lastClose[sym] == null) complete = false;
      else value += holdings[sym].shares * lastClose[sym];
    }
    if (complete) series.push({ date: dateKey, ts, value });
  }
  return series;
}

function valueAtOrBefore(series, ts) {
  let chosen = null;
  for (const pt of series) {
    if (pt.ts <= ts) chosen = pt;
    else break;
  }
  return chosen || series[0];
}

// Overall P/L tracker with day/week/month/year windows (anchored at latest available date).
export async function plTracker() {
  const series = await dailySeries();
  if (series.length === 0) throw new Error('no portfolio series');
  const latest = series[series.length - 1];
  const cost = CAPITAL;

  const windows = {
    day: 1 * DAY,
    week: 7 * DAY,
    month: 30 * DAY,
    year: 365 * DAY,
  };

  const result = {};
  for (const [name, secs] of Object.entries(windows)) {
    let startTs = latest.ts - secs;
    let clampedToInception = false;
    if (startTs < PURCHASE_TS) {
      startTs = PURCHASE_TS;
      clampedToInception = true;
    }
    const start = valueAtOrBefore(series, startTs);
    const change = latest.value - start.value;
    result[name] = {
      window: name,
      fromDate: start.date,
      toDate: latest.date,
      fromValue: start.value,
      toValue: latest.value,
      change,
      changePct: change / start.value,
      clampedToInception,
    };
  }

  return {
    asOf: latest.date,
    currentValue: latest.value,
    costBasis: cost,
    totalPl: latest.value - cost,
    totalPlPct: (latest.value - cost) / cost,
    windows: result,
    series, // full daily value series for charting
  };
}

// Live quotes for all holdings (real-time-ish, short TTL).
export async function getLiveQuotes() {
  const holdings = await getHoldings();
  const quotes = {};
  for (const sym of SYMBOLS) {
    const q = await getQuote(sym);
    quotes[sym] = { ...q, shares: holdings[sym].shares };
  }
  return quotes;
}

// Real-time P/L tracker: current value from live prices, day change vs previous close,
// week/month/year from the daily series. Appends a live point so charts reach "now".
export async function liveTracker() {
  const holdings = await getHoldings();
  const series = await dailySeries();
  const quotes = await getLiveQuotes();

  let liveValue = 0;
  let prevCloseValue = 0;
  const cost = CAPITAL;
  const positions = [];
  let marketState = 'CLOSED';
  let latestTime = 0;

  for (const sym of SYMBOLS) {
    const h = holdings[sym];
    const q = quotes[sym];
    const value = h.shares * q.price;
    const prevValue = q.previousClose != null ? h.shares * q.previousClose : value;
    liveValue += value;
    prevCloseValue += prevValue;
    if (q.marketState && q.marketState !== 'CLOSED') marketState = q.marketState;
    if (q.time > latestTime) latestTime = q.time;
    positions.push({
      symbol: sym,
      shares: h.shares,
      buyPrice: h.buyPrice,
      price: q.price,
      previousClose: q.previousClose,
      value,
      dayChange: value - prevValue,
      dayChangePct: prevValue ? (value - prevValue) / prevValue : 0,
      cost: h.dollarsAllocated,
      pl: value - h.dollarsAllocated,
      plPct: (value - h.dollarsAllocated) / h.dollarsAllocated,
    });
  }

  const nowTs = latestTime || Math.floor(Date.now() / 1000);

  // Week/month/year windows anchored at the live value.
  const longWindows = { week: 7 * DAY, month: 30 * DAY, year: 365 * DAY };
  const windows = {
    // Day change is live vs previous close (works whether the market is open or closed).
    day: {
      window: 'day',
      change: liveValue - prevCloseValue,
      changePct: prevCloseValue ? (liveValue - prevCloseValue) / prevCloseValue : 0,
      fromValue: prevCloseValue,
      toValue: liveValue,
      basis: 'previous close',
    },
  };
  for (const [name, secs] of Object.entries(longWindows)) {
    let startTs = nowTs - secs;
    let clampedToInception = false;
    if (startTs < PURCHASE_TS) {
      startTs = PURCHASE_TS;
      clampedToInception = true;
    }
    const start = valueAtOrBefore(series, startTs);
    windows[name] = {
      window: name,
      fromDate: start.date,
      fromValue: start.value,
      toValue: liveValue,
      change: liveValue - start.value,
      changePct: start.value ? (liveValue - start.value) / start.value : 0,
      clampedToInception,
    };
  }

  // Append the live point so the value chart extends to "now".
  const liveSeries = [...series];
  const nowDate = new Date(nowTs * 1000).toISOString().slice(0, 10);
  if (liveSeries.length && liveSeries[liveSeries.length - 1].date === nowDate) {
    liveSeries[liveSeries.length - 1] = { date: nowDate, ts: nowTs, value: liveValue, live: true };
  } else {
    liveSeries.push({ date: nowDate, ts: nowTs, value: liveValue, live: true });
  }

  return {
    live: true,
    asOf: new Date(nowTs * 1000).toISOString(),
    marketState,
    currentValue: liveValue,
    previousCloseValue: prevCloseValue,
    costBasis: cost,
    totalPl: liveValue - cost,
    totalPlPct: (liveValue - cost) / cost,
    windows,
    positions,
    series: liveSeries,
  };
}

// Timeframe -> Yahoo params for per-stock charts.
const TIMEFRAMES = {
  '1D': { interval: '5m', range: '1d', ttlMs: 2 * 60 * 1000 },
  '1W': { interval: '30m', range: '5d', ttlMs: 5 * 60 * 1000 },
  '1M': { interval: '1d', range: '1mo', ttlMs: 10 * 60 * 1000 },
  '3M': { interval: '1d', range: '3mo', ttlMs: 30 * 60 * 1000 },
  '6M': { interval: '1d', range: '6mo', ttlMs: 30 * 60 * 1000 },
  YTD: { interval: '1d', range: 'ytd', ttlMs: 30 * 60 * 1000 },
  '1Y': { interval: '1d', range: '1y', ttlMs: 60 * 60 * 1000 },
  // "SINCE" = since purchase date, daily granularity — the window most relevant to this portfolio.
  SINCE: { interval: '1d', sincePurchase: true, ttlMs: 30 * 60 * 1000 },
};

export function timeframeList() {
  return Object.keys(TIMEFRAMES);
}

export async function stockHistory(symbol, timeframe = 'SINCE') {
  const sym = symbol.toUpperCase();
  if (!SYMBOLS.includes(sym)) throw new Error(`unknown symbol ${sym}`);
  const tf = TIMEFRAMES[timeframe] || TIMEFRAMES.SINCE;

  let params;
  if (tf.sincePurchase) {
    const now = Math.floor(Date.now() / 1000);
    params = { interval: tf.interval, period1: PURCHASE_TS - 3 * DAY, period2: now };
  } else {
    params = { interval: tf.interval, range: tf.range };
  }
  const chart = await getChart(sym, params, { ttlMs: tf.ttlMs });

  const holdings = await getHoldings();
  const h = holdings[sym];

  // Markers for purchase (Feb 23) and snapshot (Mar 2), if within the visible range.
  const first = chart.bars[0]?.t ?? 0;
  const last = chart.bars[chart.bars.length - 1]?.t ?? 0;
  const markers = [];
  if (PURCHASE_TS >= first && PURCHASE_TS <= last)
    markers.push({ type: 'purchase', ts: PURCHASE_TS, price: h.buyPrice, label: 'Bought' });
  if (SNAPSHOT_TS >= first && SNAPSHOT_TS <= last) {
    const snap = await getPriceAt(sym, SNAPSHOT_TS);
    markers.push({ type: 'snapshot', ts: SNAPSHOT_TS, price: snap.price, label: 'Mar 2 11:00' });
  }

  return {
    symbol: sym,
    timeframe,
    interval: chart.interval,
    currency: chart.currency,
    buyPrice: h.buyPrice,
    shares: h.shares,
    bars: chart.bars.map((b) => ({ t: b.t, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })),
    markers,
  };
}

// Everything the dashboard needs in one call.
export async function fullSummary() {
  const holdings = await getHoldings();
  const purchase = await snapshotAt(PURCHASE_TS); // sanity: value should ~= CAPITAL
  const marchSnapshot = await snapshotAt(SNAPSHOT_TS);
  const live = await liveTracker();
  return {
    meta: META,
    holdings,
    purchasePortfolio: purchase,
    marchSnapshot,
    plTracker: {
      live: true,
      asOf: live.asOf,
      marketState: live.marketState,
      currentValue: live.currentValue,
      previousCloseValue: live.previousCloseValue,
      costBasis: live.costBasis,
      totalPl: live.totalPl,
      totalPlPct: live.totalPlPct,
      windows: live.windows,
      positions: live.positions,
    },
    valueSeries: live.series,
  };
}
