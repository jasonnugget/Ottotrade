import { getPublicSupabase } from './supabase.js';

const DAY = 86400;
const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'SINCE'];

let datasetPromise;

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
  const [
    metaRes,
    holdingsRes,
    eventsRes,
    impactsRes,
    edgesRes,
    barsRes,
  ] = await Promise.all([
    supabase.from('demo_portfolio_meta').select('*').eq('id', 'default').single(),
    supabase.from('demo_portfolio_holdings').select('*').order('ticker'),
    supabase.from('demo_events').select('*').order('event_date'),
    supabase.from('demo_event_impacts').select('*').order('event_id'),
    supabase.from('demo_event_edges').select('*').order('source_event_id'),
    fetchAllRows(supabase, 'demo_stock_bars', 'bar_ts'),
  ]);

  for (const result of [metaRes, holdingsRes, eventsRes, impactsRes, edgesRes, barsRes]) {
    if (result.error) throw result.error;
  }

  return {
    meta: metaRes.data,
    holdings: holdingsRes.data,
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

function buildDataset(rows) {
  const barIndex = indexBars(rows.bars);
  const holdings = rows.holdings.map((row) => ({
    symbol: row.ticker,
    company: row.company,
    sector: row.sector,
    dollarsAllocated: asNum(row.allocation_usd),
    weight: asNum(row.allocation_pct) / 100,
    buyPrice: asNum(row.buy_price),
    buyPriceMethod: row.buy_price_method,
    snapshotPrice: asNum(row.snapshot_price),
    snapshotPriceMethod: row.snapshot_price_method,
    shares: asNum(row.shares),
  }));

  const holdingsBySymbol = Object.fromEntries(holdings.map((holding) => [holding.symbol, holding]));
  const stockMap = Object.fromEntries(
    holdings.map((holding) => [
      holding.symbol,
      { name: holding.company, sector: holding.sector, allocation: holding.dollarsAllocated },
    ])
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
      purchase: {
        date: rows.meta.purchase_date,
        ts: toUnix(rows.meta.purchase_ts),
      },
      snapshot: {
        date: rows.meta.snapshot_date,
        ts: toUnix(rows.meta.snapshot_ts),
        hourEst: rows.meta.snapshot_hour_est,
      },
    },
    holdings,
    holdingsBySymbol,
    stockMap,
    events,
    eventsById,
    eventEdges,
    barIndex,
  };
}

async function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = loadRows().then(buildDataset);
  }
  return datasetPromise;
}

function unionDailySeries(data) {
  const lastClose = {};
  const dateMap = new Map();

  for (const holding of data.holdings) {
    const bars = data.barIndex[holding.symbol]?.['1d'] || [];
    for (const bar of bars) {
      const date = isoDay(bar.t);
      if (!dateMap.has(date)) dateMap.set(date, { ts: bar.t, closes: {} });
      dateMap.get(date).closes[holding.symbol] = bar.c;
    }
  }

  const series = [];
  for (const [date, point] of [...dateMap.entries()].sort((a, b) => a[1].ts - b[1].ts)) {
    let value = 0;
    let complete = true;
    for (const holding of data.holdings) {
      const close = point.closes[holding.symbol];
      if (close != null) lastClose[holding.symbol] = close;
      if (lastClose[holding.symbol] == null) {
        complete = false;
      } else {
        value += holding.shares * lastClose[holding.symbol];
      }
    }
    if (complete) series.push({ date, ts: point.ts, value });
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

function latestQuoteForSymbol(data, symbol) {
  const intraday = data.barIndex[symbol]?.['5m'] || [];
  const daily = data.barIndex[symbol]?.['1d'] || [];
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
    change:
      current?.c != null && previousClose != null ? current.c - previousClose : null,
    changePct:
      current?.c != null && previousClose ? (current.c - previousClose) / previousClose : null,
    marketState: 'SNAPSHOT',
    time: current?.t ?? null,
  };
}

async function getLivePayload() {
  const data = await loadDataset();
  const dailySeries = unionDailySeries(data);
  const quotes = {};
  const positions = [];
  let liveValue = 0;
  let prevCloseValue = 0;
  let nowTs = 0;

  for (const holding of data.holdings) {
    const quote = latestQuoteForSymbol(data, holding.symbol);
    quotes[holding.symbol] = { ...quote, shares: holding.shares };
    const value = holding.shares * quote.price;
    const prevValue =
      quote.previousClose != null ? holding.shares * quote.previousClose : value;
    liveValue += value;
    prevCloseValue += prevValue;
    nowTs = Math.max(nowTs, quote.time || 0);
    positions.push({
      symbol: holding.symbol,
      shares: holding.shares,
      buyPrice: holding.buyPrice,
      price: quote.price,
      previousClose: quote.previousClose,
      value,
      dayChange: value - prevValue,
      dayChangePct: prevValue ? (value - prevValue) / prevValue : 0,
      cost: holding.dollarsAllocated,
      pl: value - holding.dollarsAllocated,
      plPct: (value - holding.dollarsAllocated) / holding.dollarsAllocated,
    });
  }

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

  for (const [name, secs] of Object.entries({ week: 7 * DAY, month: 30 * DAY, year: 365 * DAY })) {
    const startTs = Math.max(nowTs - secs, data.meta.purchase.ts);
    const start = valueAtOrBefore(dailySeries, startTs);
    windows[name] = {
      window: name,
      fromDate: start.date,
      fromValue: start.value,
      toValue: liveValue,
      change: liveValue - start.value,
      changePct: start.value ? (liveValue - start.value) / start.value : 0,
      clampedToInception: startTs === data.meta.purchase.ts,
    };
  }

  const nowDate = isoDay(nowTs);
  const series = [...dailySeries];
  if (series.length && series[series.length - 1].date === nowDate) {
    series[series.length - 1] = { date: nowDate, ts: nowTs, value: liveValue, live: true };
  } else {
    series.push({ date: nowDate, ts: nowTs, value: liveValue, live: true });
  }

  return {
    live: true,
    asOf: new Date(nowTs * 1000).toISOString(),
    marketState: 'SNAPSHOT',
    currentValue: liveValue,
    previousCloseValue: prevCloseValue,
    costBasis: data.meta.capital,
    totalPl: liveValue - data.meta.capital,
    totalPlPct: (liveValue - data.meta.capital) / data.meta.capital,
    windows,
    positions,
    series,
    quotes,
  };
}

function barsForTimeframe(data, symbol, timeframe) {
  const daily = data.barIndex[symbol]?.['1d'] || [];
  const intraday = data.barIndex[symbol]?.['5m'] || [];
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
      return { interval: '1d', bars: daily.filter((bar) => bar.t >= data.meta.purchase.ts - 3 * DAY) };
  }
}

async function getStockHistoryPayload(symbol, timeframe = 'SINCE') {
  const data = await loadDataset();
  const holding = data.holdingsBySymbol[symbol];
  if (!holding) throw new Error(`unknown symbol ${symbol}`);

  const { interval, bars } = barsForTimeframe(data, symbol, timeframe);
  const first = bars[0]?.t ?? 0;
  const last = bars[bars.length - 1]?.t ?? 0;
  const markers = [];

  if (data.meta.purchase.ts >= first && data.meta.purchase.ts <= last) {
    markers.push({
      type: 'purchase',
      ts: data.meta.purchase.ts,
      price: holding.buyPrice,
      label: 'Bought',
    });
  }
  if (data.meta.snapshot.ts >= first && data.meta.snapshot.ts <= last) {
    markers.push({
      type: 'snapshot',
      ts: data.meta.snapshot.ts,
      price: holding.snapshotPrice,
      label: 'Mar 2 11:00',
    });
  }

  return {
    symbol,
    timeframe,
    interval,
    buyPrice: holding.buyPrice,
    bars,
    markers,
  };
}

export const api = {
  meta: async () => (await loadDataset()).meta,
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
  events: async () => (await loadDataset()).events,
  graph: async (until) => {
    const data = await loadDataset();
    const cutoff = until ? toUnix(until) : Infinity;
    const events = data.events.filter((event) => event.ts <= cutoff);
    const nodes = [
      ...Object.entries(data.stockMap).map(([symbol, info]) => ({
        id: symbol,
        type: 'stock',
        label: symbol,
        name: info.name,
        sector: info.sector,
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
      ...events.flatMap((event) =>
        event.impacts.map((impact) => ({
          id: `${event.id}->${impact.ticker}`,
          source: event.id,
          target: impact.ticker,
          kind: 'event-stock',
          tier: impact.tier,
          direction: impact.direction,
          pct_change: impact.pct_change,
          reasoning: impact.reasoning,
        }))
      ),
      ...data.eventEdges.filter(
        (edge) => data.eventsById[edge.source]?.ts <= cutoff && data.eventsById[edge.target]?.ts <= cutoff
      ),
    ];

    return { nodes, edges, eventCount: events.length };
  },
  timeline: async () => {
    const data = await loadDataset();
    const points = unionDailySeries(data);
    const markers = data.events.map((event) => ({
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
  stocks: async () => (await loadDataset()).stockMap,
  enrichStatus: async () => ({ available: false, provider: 'supabase' }),
  enrich: async (id) => {
    const data = await loadDataset();
    const event = data.eventsById[id];
    if (!event) throw new Error(`unknown event ${id}`);
    return { id, headline: event.headline, curated: event.impacts, ai: null };
  },
  stockHistory: async (symbol, timeframe) => {
    const sym = symbol.toUpperCase();
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
