import { usd, signedPct, plClass } from '../../api.js';
import { useEffect, useMemo, useState } from 'react';
import { tierColor, categoryLabel } from '../../shared/theme.js';
import ExploreConnectionWeb from './ExploreConnectionWeb.jsx';
import EventPanel from '../../shared/EventPanel.jsx';
import StockDetail from './StockDetail.jsx';
import './explore.css';

// Drill-in for one stock: price chart + a bubble map of the events that moved it.
// symbol is null until a stock is picked (from the picker below, or via onOpenStock
// from another tab) — this is a standalone sidebar tab, not just a drill-in anymore.
export default function ExploreTab({
  symbol,
  name,
  subgraph,
  eventsById,
  position,
  positions,
  stocks,
  selectedEvent,
  related,
  onSelect,
  onPickSymbol,
  onBack,
  backLabel,
  enrich,
}) {
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState('chart');
  // Built from the real tradable universe (the stocks that actually have price data
  // seeded), not a hardcoded list — a ticker in this picker with no bars behind it would
  // open to an empty chart.
  const topStocks = useMemo(() => Object.entries(stocks || {})
    .map(([stockSymbol, info]) => ({
      symbol: stockSymbol,
      name: info.name,
      position: positions?.find((item) => item.symbol === stockSymbol),
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol)), [positions, stocks]);
  const filteredStocks = topStocks.filter((stock) => {
    const search = query.trim().toLowerCase();
    return !search || stock.symbol.toLowerCase().includes(search) || stock.name.toLowerCase().includes(search);
  });

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
          <label className="stock-search">
            <span className="sr-only">Search stocks</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by ticker or company"
            />
          </label>
          <div className="holdings-list explore-stock-list">
            {filteredStocks.map((stock) => (
              <button className="holding-row" key={stock.symbol} onClick={() => onPickSymbol(stock.symbol)}>
                <div className="hr-left">
                  <div className="hr-sym">{stock.symbol}</div>
                  <div className="hr-name muted tiny">{stock.name}</div>
                </div>
                {stock.position && <div className="hr-val">{usd(stock.position.value)}</div>}
                {stock.position && <div className={`hr-day ${plClass(stock.position.dayChange)}`}>{signedPct(stock.position.dayChangePct)}</div>}
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
              })} enrich={enrich} />
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
