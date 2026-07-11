import { usd, signedPct, plClass } from '../api.js';
import { tierColor, categoryLabel } from './theme.js';
import { useStageSize } from './graphUtils.js';
import ConnectionWeb from './ConnectionWeb.jsx';
import StockDetail from './StockDetail.jsx';
import EventPanel from './EventPanel.jsx';

// Drill-in for one stock: price chart + a bubble map of the events that moved it.
export default function StockView({
  symbol,
  name,
  subgraph,
  eventsById,
  position,
  selectedEvent,
  related,
  onSelect,
  onBack,
  enrich,
}) {
  const [stageRef, size] = useStageSize();
  const stockEvents = subgraph.nodes.filter((n) => n.type === 'event');

  return (
    <div className="stockview">
      <header className="sv-header">
        <button className="back-btn" onClick={onBack}>← Portfolio</button>
        <div className="sv-id">
          <span className="sv-ticker">{symbol}</span>
          <span className="muted">{name}</span>
        </div>
        {position && (
          <div className="sv-price">
            {usd(position.price)}{' '}
            <span className={plClass(position.dayChange)}>{signedPct(position.dayChangePct)} today</span>
          </div>
        )}
      </header>

      <div className="sv-chart card">
        <StockDetail symbol={symbol} name={name} />
      </div>

      <div className="sv-map-row">
        <div className="sv-map card" ref={stageRef}>
          <div className="sv-map-title">Event web for {symbol} — what moved it & why</div>
          <ConnectionWeb
            graph={subgraph}
            selectedId={selectedEvent?.id}
            onSelect={onSelect}
            width={size.w}
            height={size.h - 34}
          />
        </div>

        <aside className="sv-side">
          {selectedEvent ? (
            <EventPanel event={selectedEvent} related={related} onPick={onSelect && ((id) => {
              if (eventsById[id]) onSelect({ id, type: 'event' });
            })} enrich={enrich} />
          ) : (
            <div className="card sv-eventlist">
              <div className="card-head"><h2>{stockEvents.length} events</h2><span className="muted tiny">tap a bubble or row</span></div>
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
    </div>
  );
}
