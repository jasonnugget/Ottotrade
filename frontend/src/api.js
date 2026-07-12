import { getPublicSupabase, getSupabase } from './supabase.js';

const DAY = 86400;
const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'SINCE'];

// Reference data (prices, events, the tradable universe) is public and immutable, so it's
// fetched once. The user's LOTS are separate: they change whenever a stock is added or
// sold, so they're cached only until the next mutation (see invalidatePortfolio).
let referencePromise;
let lotsPromise;

function toUnix(value) {
  if (typeof value === 'number') return value;
  return Math.floor(new Date(value).getTime() / 1000);
}

function isoDay(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function asNum(value) {
  return value == null ? null : Number(value);
}

function sortByTsAsc(a, b) {
  return a.t - b.t;
}

// PostgREST caps a single response to its configured max-rows (commonly 1000),
// so stock bars must be fetched page by page to avoid silently truncating chart data.
const MAX_PAGE_SIZE = 1000;

async function fetchAllRows(supabase, table, orderColumn) {
  const rows = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn)
      .range(offset, offset + MAX_PAGE_SIZE - 1);

    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < MAX_PAGE_SIZE) break;
    offset += MAX_PAGE_SIZE;
  }

  return { data: rows, error: null };
}

async function loadRows() {
  const supabase = getPublicSupabase();
  const [metaRes, stocksRes, eventsRes, impactsRes, edgesRes, barsRes] = await Promise.all([
    supabase.from('demo_portfolio_meta').select('*').eq('id', 'default').single(),
    supabase.from('demo_stocks').select('*').order('ticker'),
    supabase.from('demo_events').select('*').order('event_date'),
    supabase.from('demo_event_impacts').select('*').order('event_id'),
    supabase.from('demo_event_edges').select('*').order('source_event_id'),
    fetchAllRows(supabase, 'demo_stock_bars', 'bar_ts'),
  ]);

  for (const result of [metaRes, stocksRes, eventsRes, impactsRes, edgesRes, barsRes]) {
    if (result.error) throw result.error;
  }

  return {
    meta: metaRes.data,
    stocks: stocksRes.data,
    events: eventsRes.data,
    impacts: impactsRes.data,
    edges: edgesRes.data,
    bars: barsRes.data,
  };
}

function indexBars(barRows) {
  const byTicker = {};
  for (const row of barRows) {
    const ticker = row.ticker;
    const interval = row.interval;
    const bar = {
      t: toUnix(row.bar_ts),
      o: asNum(row.open),
      h: asNum(row.high),
      l: asNum(row.low),
      c: asNum(row.close),
      adjclose: asNum(row.adjclose),
      volume: Number(row.volume || 0),
    };
    if (!byTicker[ticker]) byTicker[ticker] = {};
    if (!byTicker[ticker][interval]) byTicker[ticker][interval] = [];
    byTicker[ticker][interval].push(bar);
  }

  for (const perTicker of Object.values(byTicker)) {
    for (const bars of Object.values(perTicker)) bars.sort(sortByTsAsc);
  }

  return byTicker;
}

function buildReference(rows) {
  const barIndex = indexBars(rows.bars);

  // Every ticker a user can buy, with the display metadata the UI needs.
  const stockMap = Object.fromEntries(
    rows.stocks.map((row) => [row.ticker, { name: row.company, sector: row.sector }])
  );

  const impactsByEvent = {};
  for (const row of rows.impacts) {
    if (!impactsByEvent[row.event_id]) impactsByEvent[row.event_id] = [];
    impactsByEvent[row.event_id].push({
      ticker: row.ticker,
      tier: row.tier,
      direction: row.direction,
      reasoning: row.reasoning,
      pct_change: asNum(row.pct_change),
      price: asNum(row.price),
      reaction_date: row.reaction_date,
    });
  }

  const events = rows.events.map((row) => ({
    id: row.id,
    date: new Date(row.event_date).toISOString(),
    headline: row.headline,
    category: row.category,
    location: row.location_name
      ? {
          lat: asNum(row.location_lat),
          lon: asNum(row.location_lon),
          name: row.location_name,
        }
      : null,
    source: {
      outlet: row.source_outlet,
      url: row.source_url,
      published_at: row.source_published_at,
      updated_at: row.source_updated_at,
    },
    related_event_ids: row.related_event_ids || [],
    confidence_tier: row.confidence_tier,
    magnitude: asNum(row.magnitude) || 0,
    impacts: impactsByEvent[row.id] || [],
    affected_tickers: (impactsByEvent[row.id] || []).map((impact) => impact.ticker),
    ts: toUnix(row.event_date),
  }));

  const eventsById = Object.fromEntries(events.map((event) => [event.id, event]));
  const eventEdges = rows.edges.map((row) => ({
    id: `sim:${row.source_event_id}|${row.target_event_id}`,
    source: row.source_event_id,
    target: row.target_event_id,
    kind: 'event-event',
    weight: asNum(row.weight),
    declared: row.declared,
  }));

  return {
    meta: {
      capital: asNum(rows.meta.capital),
      purchase: { date: rows.meta.purchase_date, ts: toUnix(rows.meta.purchase_ts) },
      snapshot: {
        date: rows.meta.snapshot_date,
        ts: toUnix(rows.meta.snapshot_ts),
        hourEst: rows.meta.snapshot_hour_est,
      },
    },
    stockMap,
    events,
    eventsById,
    eventEdges,
    barIndex,
  };
}

async function loadReference() {
  if (!referencePromise) referencePromise = loadRows().then(buildReference);
  return referencePromise;
}

// ---- The user's portfolio: real lots, real cost basis --------------------------------

async function loadLots() {
  if (!lotsPromise) {
    lotsPromise = getSupabase()
      .from('portfolio_lots')
      .select('*')
      .order('purchase_date')
      .then(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row) => ({
          id: row.id,
          symbol: row.ticker,
          shares: asNum(row.shares),
          buyPrice: asNum(row.buy_price),
          purchaseDate: row.purchase_date,
          purchaseTs: toUnix(`${row.purchase_date}T00:00:00Z`),
          cost: asNum(row.shares) * asNum(row.buy_price),
        }));
      });
  }
  return lotsPromise;
}

function invalidatePortfolio() {
  lotsPromise = undefined;
}

// Called on every auth change (see App.jsx). Without this, the lots cached for the user who
// just signed out would still be in memory when the next user signs in — they'd briefly see
// someone else's portfolio. Reference data (prices, events) is public, so it can stay.
export function resetPortfolioCache() {
  lotsPromise = undefined;
}

// Collapse a ticker's lots into one holding. This is where average cost per share comes
// from: total dollars spent / total shares owned — NOT the price of the most recent buy.
function holdingsFromLots(lots) {
  const bySymbol = new Map();
  for (const lot of lots) {
    const holding = bySymbol.get(lot.symbol) || {
      symbol: lot.symbol,
      shares: 0,
      cost: 0,
      lots: [],
      firstPurchaseTs: Infinity,
    };
    holding.shares += lot.shares;
    holding.cost += lot.cost;
    holding.lots.push(lot);
    holding.firstPurchaseTs = Math.min(holding.firstPurchaseTs, lot.purchaseTs);
    bySymbol.set(lot.symbol, holding);
  }

  for (const holding of bySymbol.values()) {
    holding.avgCost = holding.shares > 0 ? holding.cost / holding.shares : 0;
    holding.lots.sort((a, b) => a.purchaseTs - b.purchaseTs);
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function loadPortfolio() {
  const [reference, lots] = await Promise.all([loadReference(), loadLots()]);
  const holdings = holdingsFromLots(lots);
  return { reference, lots, holdings };
}

// Portfolio value over time. A lot only counts from the day it was actually bought — that
// is the whole point of tracking purchase dates, and it's why buying a stock today doesn't
// retroactively inflate last month's portfolio value.
function unionDailySeries(reference, lots) {
  if (!lots.length) return [];

  const symbols = [...new Set(lots.map((lot) => lot.symbol))];
  const dateMap = new Map();
  for (const symbol of symbols) {
    for (const bar of reference.barIndex[symbol]?.['1d'] || []) {
      const date = isoDay(bar.t);
      if (!dateMap.has(date)) dateMap.set(date, { ts: bar.t, closes: {} });
      dateMap.get(date).closes[symbol] = bar.c;
    }
  }

  const earliestPurchase = Math.min(...lots.map((lot) => lot.purchaseTs));
  const lastClose = {};
  const series = [];

  for (const [date, point] of [...dateMap.entries()].sort((a, b) => a[1].ts - b[1].ts)) {
    for (const symbol of symbols) {
      if (point.closes[symbol] != null) lastClose[symbol] = point.closes[symbol];
    }
    if (point.ts < earliestPurchase) continue;

    let value = 0;
    let priced = true;
    for (const lot of lots) {
      if (lot.purchaseTs > point.ts) continue; // not owned yet on this date
      const close = lastClose[lot.symbol];
      if (close == null) {
        priced = false;
        break;
      }
      value += lot.shares * close;
    }
    if (priced) series.push({ date, ts: point.ts, value });
  }

  return series;
}

function valueAtOrBefore(series, ts) {
  let chosen = series[0];
  for (const point of series) {
    if (point.ts <= ts) chosen = point;
    else break;
  }
  return chosen;
}

function latestQuoteForSymbol(reference, symbol) {
  const intraday = reference.barIndex[symbol]?.['5m'] || [];
  const daily = reference.barIndex[symbol]?.['1d'] || [];
  const current = intraday[intraday.length - 1] || daily[daily.length - 1];
  const latestDay = current ? isoDay(current.t) : null;
  let previousClose = null;
  if (daily.length) {
    const lastDaily = daily[daily.length - 1];
    if (latestDay && isoDay(lastDaily.t) === latestDay) {
      previousClose = daily[daily.length - 2]?.c ?? lastDaily.c;
    } else {
      previousClose = lastDaily.c;
    }
  }
  return {
    symbol,
    price: current?.c ?? null,
    previousClose,
    change: current?.c != null && previousClose != null ? current.c - previousClose : null,
    changePct:
      current?.c != null && previousClose ? (current.c - previousClose) / previousClose : null,
    marketState: 'SNAPSHOT',
    time: current?.t ?? null,
  };
}

async function getLivePayload() {
  const { reference, lots, holdings } = await loadPortfolio();
  const dailySeries = unionDailySeries(reference, lots);

  const quotes = {};
  const positions = [];
  let liveValue = 0;
  let prevCloseValue = 0;
  let costBasis = 0;
  let nowTs = 0;

  for (const holding of holdings) {
    const quote = latestQuoteForSymbol(reference, holding.symbol);
    quotes[holding.symbol] = { ...quote, shares: holding.shares };

    const value = quote.price != null ? holding.shares * quote.price : 0;
    const prevValue = quote.previousClose != null ? holding.shares * quote.previousClose : value;
    liveValue += value;
    prevCloseValue += prevValue;
    costBasis += holding.cost;
    nowTs = Math.max(nowTs, quote.time || 0);

    positions.push({
      symbol: holding.symbol,
      name: reference.stockMap[holding.symbol]?.name,
      shares: holding.shares,
      avgCost: holding.avgCost,
      buyPrice: holding.avgCost, // kept for callers that still read buyPrice
      price: quote.price,
      previousClose: quote.previousClose,
      value,
      dayChange: value - prevValue,
      dayChangePct: prevValue ? (value - prevValue) / prevValue : 0,
      cost: holding.cost,
      pl: value - holding.cost,
      plPct: holding.cost ? (value - holding.cost) / holding.cost : 0,
      firstPurchaseDate: isoDay(holding.firstPurchaseTs),
      lots: holding.lots,
    });
  }

  if (!nowTs) nowTs = Math.floor(Date.now() / 1000);

  const windows = {
    day: {
      window: 'day',
      change: liveValue - prevCloseValue,
      changePct: prevCloseValue ? (liveValue - prevCloseValue) / prevCloseValue : 0,
      fromValue: prevCloseValue,
      toValue: liveValue,
      basis: 'previous close',
    },
  };

  const inceptionTs = lots.length ? Math.min(...lots.map((lot) => lot.purchaseTs)) : nowTs;
  for (const [name, secs] of Object.entries({ week: 7 * DAY, month: 30 * DAY, year: 365 * DAY })) {
    const startTs = Math.max(nowTs - secs, inceptionTs);
    const start = dailySeries.length ? valueAtOrBefore(dailySeries, startTs) : null;
    windows[name] = {
      window: name,
      fromDate: start?.date ?? null,
      fromValue: start?.value ?? 0,
      toValue: liveValue,
      change: start ? liveValue - start.value : 0,
      changePct: start?.value ? (liveValue - start.value) / start.value : 0,
      clampedToInception: startTs === inceptionTs,
    };
  }

  const nowDate = isoDay(nowTs);
  const series = [...dailySeries];
  if (series.length && series[series.length - 1].date === nowDate) {
    series[series.length - 1] = { date: nowDate, ts: nowTs, value: liveValue, live: true };
  } else if (holdings.length) {
    series.push({ date: nowDate, ts: nowTs, value: liveValue, live: true });
  }

  return {
    live: true,
    asOf: new Date(nowTs * 1000).toISOString(),
    marketState: 'SNAPSHOT',
    isEmpty: holdings.length === 0,
    currentValue: liveValue,
    previousCloseValue: prevCloseValue,
    costBasis,
    totalPl: liveValue - costBasis,
    totalPlPct: costBasis ? (liveValue - costBasis) / costBasis : 0,
    windows,
    positions,
    series,
    quotes,
  };
}

function barsForTimeframe(reference, symbol, timeframe) {
  const daily = reference.barIndex[symbol]?.['1d'] || [];
  const intraday = reference.barIndex[symbol]?.['5m'] || [];
  const nowTs = (intraday[intraday.length - 1] || daily[daily.length - 1])?.t || 0;
  const startOfYear = new Date(new Date(nowTs * 1000).getFullYear(), 0, 1).getTime() / 1000;

  switch (timeframe) {
    case '1D':
      return { interval: '5m', bars: intraday };
    case '1W':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= nowTs - 7 * DAY) };
    case '1M':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= nowTs - 30 * DAY) };
    case '3M':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= nowTs - 90 * DAY) };
    case '6M':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= nowTs - 180 * DAY) };
    case 'YTD':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= startOfYear) };
    case '1Y':
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= nowTs - 365 * DAY) };
    case 'SINCE':
    default:
      return { interval: '1d', bars: daily };
  }
}

async function getStockHistoryPayload(symbol, timeframe = 'SINCE') {
  const { reference, holdings } = await loadPortfolio();
  if (!reference.stockMap[symbol]) throw new Error(`unknown symbol ${symbol}`);

  const holding = holdings.find((item) => item.symbol === symbol) || null;
  const { interval, bars } = barsForTimeframe(reference, symbol, timeframe);
  const first = bars[0]?.t ?? 0;
  const last = bars[bars.length - 1]?.t ?? 0;

  // One marker per actual purchase lot, rather than a single hardcoded buy date.
  const markers = (holding?.lots || [])
    .filter((lot) => lot.purchaseTs >= first && lot.purchaseTs <= last)
    .map((lot) => ({
      type: 'purchase',
      ts: lot.purchaseTs,
      price: lot.buyPrice,
      label: `Bought ${lot.shares.toLocaleString('en-US', { maximumFractionDigits: 2 })} @ ${usd(lot.buyPrice)}`,
    }));

  return {
    symbol,
    timeframe,
    interval,
    buyPrice: holding?.avgCost ?? null,
    shares: holding?.shares ?? 0,
    bars,
    markers,
  };
}

export const api = {
  meta: async () => (await loadReference()).meta,
  summary: async () => getLivePayload(),
  pl: async () => {
    const live = await getLivePayload();
    return {
      asOf: live.asOf,
      currentValue: live.currentValue,
      costBasis: live.costBasis,
      totalPl: live.totalPl,
      totalPlPct: live.totalPlPct,
      windows: live.windows,
      series: live.series,
      live: true,
    };
  },
  live: async () => getLivePayload(),
  quotes: async () => (await getLivePayload()).quotes,
  events: async () => (await loadReference()).events,

  graph: async (until) => {
    const { reference, holdings } = await loadPortfolio();
    const cutoff = until ? toUnix(until) : Infinity;
    const held = new Set(holdings.map((holding) => holding.symbol));

    // The event web is the user's OWN portfolio's web: only events touching a stock they
    // actually hold, and only stocks they actually hold.
    const events = reference.events.filter(
      (event) => event.ts <= cutoff && event.impacts.some((impact) => held.has(impact.ticker))
    );
    const live = await getLivePayload();
    const dayChangeBySymbol = Object.fromEntries(
      (live.positions || []).map((position) => [position.symbol, position.dayChangePct])
    );

    const eventStockEdges = events.flatMap((event) =>
      event.impacts
        .filter((impact) => held.has(impact.ticker))
        .map((impact) => ({
          id: `${event.id}->${impact.ticker}`,
          source: event.id,
          target: impact.ticker,
          kind: 'event-stock',
          tier: impact.tier,
          direction: impact.direction,
          pct_change: impact.pct_change,
          reasoning: impact.reasoning,
        }))
    );

    // How much each stock has been affected: sum of the magnitude of every event impact
    // that touched it, used to size the stock bubble (bigger = more shaken up).
    const impactMagnitudeBySymbol = {};
    for (const edge of eventStockEdges) {
      const magnitude = Math.abs(edge.pct_change || 0);
      impactMagnitudeBySymbol[edge.target] = (impactMagnitudeBySymbol[edge.target] || 0) + magnitude;
    }

    const eventIds = new Set(events.map((event) => event.id));
    const nodes = [
      ...holdings.map((holding) => ({
        id: holding.symbol,
        type: 'stock',
        label: holding.symbol,
        name: reference.stockMap[holding.symbol]?.name,
        sector: reference.stockMap[holding.symbol]?.sector,
        dayChangePct: dayChangeBySymbol[holding.symbol] ?? 0,
        impactMagnitude: impactMagnitudeBySymbol[holding.symbol] || 0,
      })),
      ...events.map((event) => ({
        id: event.id,
        type: 'event',
        label: event.headline,
        category: event.category,
        date: event.date,
        ts: event.ts,
        location: event.location,
        magnitude: event.magnitude,
        tier: event.confidence_tier,
      })),
    ];

    const edges = [
      ...eventStockEdges,
      ...reference.eventEdges.filter(
        (edge) => eventIds.has(edge.source) && eventIds.has(edge.target)
      ),
    ];

    return { nodes, edges, eventCount: events.length };
  },

  timeline: async () => {
    const { reference, lots, holdings } = await loadPortfolio();
    const points = unionDailySeries(reference, lots);
    const held = new Set(holdings.map((holding) => holding.symbol));
    const markers = reference.events
      .filter((event) => event.impacts.some((impact) => held.has(impact.ticker)))
      .map((event) => ({
        id: event.id,
        ts: event.ts,
        date: event.date.slice(0, 10),
        headline: event.headline,
        tier: event.confidence_tier,
        category: event.category,
        magnitude: event.magnitude,
      }));
    const live = await getLivePayload();
    return {
      points,
      markers,
      start: points[0]?.ts,
      end: points[points.length - 1]?.ts,
      now: toUnix(live.asOf),
    };
  },

  // The full tradable universe (what a user is allowed to add), not just what they hold.
  universe: async () => (await loadReference()).stockMap,
  stocks: async () => (await loadReference()).stockMap,

  // ---- Portfolio mutations ----
  holdings: async () => (await loadPortfolio()).holdings,
  lots: async () => loadLots(),

  addLot: async ({ symbol, shares, buyPrice, purchaseDate }) => {
    const reference = await loadReference();
    const ticker = String(symbol || '').toUpperCase();
    if (!reference.stockMap[ticker]) throw new Error(`${ticker} is not in the tradable universe.`);
    if (!(shares > 0)) throw new Error('Quantity must be greater than zero.');
    if (!(buyPrice > 0)) throw new Error('Purchase price must be greater than zero.');
    if (!purchaseDate) throw new Error('A purchase date is required.');
    if (purchaseDate > isoDay(Math.floor(Date.now() / 1000))) {
      throw new Error('Purchase date cannot be in the future.');
    }

    const supabase = getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error('You must be signed in to change your portfolio.');

    const { error } = await supabase.from('portfolio_lots').insert({
      user_id: auth.user.id,
      ticker,
      shares,
      buy_price: buyPrice,
      purchase_date: purchaseDate,
    });
    if (error) throw error;
    invalidatePortfolio();
  },

  // Remove a single purchase lot.
  deleteLot: async (lotId) => {
    const { error } = await getSupabase().from('portfolio_lots').delete().eq('id', lotId);
    if (error) throw error;
    invalidatePortfolio();
  },

  // Sell out of a ticker entirely — removes every lot of it.
  deleteHolding: async (symbol) => {
    const { error } = await getSupabase()
      .from('portfolio_lots')
      .delete()
      .eq('ticker', String(symbol).toUpperCase());
    if (error) throw error;
    invalidatePortfolio();
  },

  // The closing price on a given date, so the add-stock form can prefill a realistic
  // purchase price instead of making the user look it up.
  priceOn: async (symbol, date) => {
    const reference = await loadReference();
    const daily = reference.barIndex[String(symbol).toUpperCase()]?.['1d'] || [];
    if (!daily.length) return null;
    const targetTs = toUnix(`${date}T23:59:59Z`);
    let chosen = null;
    for (const bar of daily) {
      if (bar.t <= targetTs) chosen = bar;
      else break;
    }
    return chosen?.c ?? daily[0].c;
  },

  enrichStatus: async () => ({ available: false, provider: 'supabase' }),
  enrich: async (id) => {
    const reference = await loadReference();
    const event = reference.eventsById[id];
    if (!event) throw new Error(`unknown event ${id}`);
    return { id, headline: event.headline, curated: event.impacts, ai: null };
  },

  stockHistory: async (symbol, timeframe) => {
    const sym = String(symbol).toUpperCase();
    if (!TIMEFRAMES.includes(timeframe)) timeframe = 'SINCE';
    return getStockHistoryPayload(sym, timeframe);
  },
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
