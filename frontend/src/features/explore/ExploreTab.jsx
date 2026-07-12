import { usd, signedPct, plClass, fmtShares } from '../../api.js';
import { useEffect, useMemo, useState } from 'react';
import { tierColor, categoryLabel } from '../../shared/theme.js';
import ExploreConnectionWeb from './ExploreConnectionWeb.jsx';
import EventPanel from '../../shared/EventPanel.jsx';
import StockDetail from './StockDetail.jsx';
import './explore.css';

// Drill-in for one stock: price chart + a bubble map of the events that moved it.
// symbol is null until a stock is picked (from the picker below, or via onOpenStock
// from another tab) — this is a standalone sidebar tab, not just a drill-in anymore.
const SORTS = {
  symbol: { label: 'A–Z', compare: (a, b) => a.symbol.localeCompare(b.symbol) },
  // Nulls last: a stock you don't hold has no holding value, and shouldn't outrank one you do.
  value: { label: 'Holding value', compare: (a, b) => (b.holdingValue ?? -1) - (a.holdingValue ?? -1) },
  change: { label: 'Daily change', compare: (a, b) => (b.dayChangePct ?? -Infinity) - (a.dayChangePct ?? -Infinity) },
};

export default function ExploreTab({
  symbol,
  name,
  subgraph,
  eventsById,
  position,
  positions,
  stocks,
  quotes,
  selectedEvent,
  related,
  onSelect,
  onPickSymbol,
  onBack,
  backLabel,
  enrich,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('symbol');
  const [activeView, setActiveView] = useState('chart');

  // Built from the real tradable universe (the stocks that actually have price data
  // seeded), not a hardcoded list — a ticker in this picker with no bars behind it would
  // open to an empty chart. Prices come from `quotes`, which covers every tradable stock;
  // `positions` only covers the ones you actually own.
  const topStocks = useMemo(() => Object.entries(stocks || {})
    .map(([stockSymbol, info]) => {
      const held = positions?.find((item) => item.symbol === stockSymbol);
      const quote = quotes?.[stockSymbol];
      return {
        symbol: stockSymbol,
        name: info.name,
        position: held,
        price: quote?.price ?? null,
        dayChangePct: quote?.changePct ?? null,
        holdingValue: held?.value ?? null,
        shares: held?.shares ?? null,
      };
    }), [positions, stocks, quotes]);

  const filteredStocks = useMemo(() => {
    const search = query.trim().toLowerCase();
    return topStocks
      .filter((stock) => !search || stock.symbol.toLowerCase().includes(search) || stock.name.toLowerCase().includes(search))
      .sort(SORTS[sort].compare);
  }, [topStocks, query, sort]);

  useEffect(() => {
    setActiveView('chart');
  }, [symbol]);

  if (!symbol) {
    return (
      <div className="stockview">
        <header className="sv-header">
          <div className="sv-id"><span className="sv-ticker">Explore</span></div>
        </header>
        <div className="card">
          <div className="card-head"><h2>{topStocks.length} tradable stocks</h2><span className="muted tiny">everything you can add to your portfolio</span></div>

          <div className="explore-controls">
            <label className="stock-search">
              <span className="sr-only">Search stocks</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by ticker or company"
              />
            </label>
            <div className="explore-sort">
              <span className="muted tiny">Sort</span>
              {Object.entries(SORTS).map(([key, { label }]) => (
                <button
                  key={key}
                  className={sort === key ? 'active' : ''}
                  onClick={() => setSort(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="explore-list-head">
            <span>Stock</span>
            <span>Price</span>
            <span>Today</span>
            <span>Holding</span>
            <span />
          </div>

          <div className="explore-stock-list">
            {filteredStocks.map((stock) => (
              <button className="explore-row" key={stock.symbol} onClick={() => onPickSymbol(stock.symbol)}>
                <div className="er-stock">
                  <div className="hr-sym">{stock.symbol}</div>
                  <div className="hr-name muted tiny">{stock.name}</div>
                </div>
                <div className="er-price num">{usd(stock.price)}</div>
                <div className={`er-day num ${stock.dayChangePct == null ? 'muted' : plClass(stock.dayChangePct)}`}>
                  {stock.dayChangePct == null ? '—' : signedPct(stock.dayChangePct)}
                </div>
                <div className="er-holding num">
                  {stock.holdingValue != null ? (
                    <>
                      {usd(stock.holdingValue)}
                      <span className="muted tiny er-shares">{fmtShares(stock.shares)} sh</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
                <div className="hr-arrow muted">›</div>
              </button>
            ))}
            {!filteredStocks.length && <div className="explore-empty muted">No stocks match “{query}”.</div>}
          </div>
        </div>
      </div>
    );
  }

  const stockEvents = (subgraph?.nodes || []).filter((n) => n.type === 'event');
  const displayName = name || topStocks.find((stock) => stock.symbol === symbol)?.name || symbol;

  return (
    <div className="stockview">
      <header className="sv-header">
        {onBack && <button className="back-btn" onClick={onBack}>← Back to {backLabel}</button>}
        <div className="sv-id">
          <span className="sv-ticker">{symbol}</span>
          <span className="muted">{displayName}</span>
        </div>
        {position && (
          <div className="sv-price">
            {usd(position.price)}{' '}
            <span className={plClass(position.dayChange)}>{signedPct(position.dayChangePct)} today</span>
          </div>
        )}
      </header>

      <div className="explore-view-tabs" role="tablist" aria-label={`${symbol} views`}>
        <button role="tab" aria-selected={activeView === 'chart'} className={activeView === 'chart' ? 'active' : ''} onClick={() => setActiveView('chart')}>Stock chart</button>
        <button role="tab" aria-selected={activeView === 'events'} className={activeView === 'events' ? 'active' : ''} onClick={() => setActiveView('events')}>Bubble map & events</button>
      </div>

      {activeView === 'chart' && (
        <div className="sv-chart card">
          {stocks?.[symbol]
            ? <StockDetail symbol={symbol} name={displayName} />
            : <div className="explore-empty muted">Historical chart data is not available for {symbol} yet.</div>}
        </div>
      )}

      {activeView === 'events' && (
        <div className="sv-map-row">
          <div className="sv-map card">
            <ExploreConnectionWeb
              graph={subgraph || { nodes: [], edges: [] }}
              selectedId={selectedEvent?.id}
              onSelect={onSelect}
            />
          </div>

          <aside className="sv-side">
            {selectedEvent ? (
              <EventPanel event={selectedEvent} related={related} onPick={onSelect && ((id) => {
                if (eventsById[id]) onSelect({ id, type: 'event' });
              })} enrich={enrich} showAi={false} />
            ) : (
              <div className="card sv-eventlist">
                <div className="card-head"><h2>{stockEvents.length} events</h2><span className="muted tiny">Tap a bubble or row</span></div>
                {stockEvents
                  .map((n) => eventsById[n.id])
                  .filter(Boolean)
                  .sort((a, b) => b.ts - a.ts)
                  .map((e) => {
                    const im = e.impacts.find((i) => i.ticker === symbol);
                    return (
                      <button className="feed-row" key={e.id} onClick={() => onSelect({ id: e.id, type: 'event' })}>
                        <span className="feed-dot" style={{ background: tierColor(im?.tier || e.confidence_tier) }} />
                        <div className="feed-body">
                          <div className="feed-head">{e.headline}</div>
                          <div className="muted tiny">{e.date.slice(0, 10)} · {categoryLabel(e.category)} · {im?.tier}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
