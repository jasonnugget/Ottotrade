import { useMemo } from 'react';
import { usd, signedUsd, signedPct, plClass, pct } from '../api.js';
import { tierColor, categoryLabel } from './theme.js';
import PortfolioChart from './PortfolioChart.jsx';

// Robinhood-style home: portfolio value, chart, clickable holdings, event feed.
export default function HomeDashboard({ live, timeline, events, stocks, onOpenStock, onOpenWeb, onOpenEvent }) {
  const points = timeline?.points || [];
  const value = live?.currentValue ?? (points.length ? points[points.length - 1].value : null);
  const cost = live?.costBasis ?? 50000;
  const totalPl = value != null ? value - cost : 0;
  const day = live?.windows?.day;

  const recent = useMemo(
    () => [...(events || [])].sort((a, b) => b.ts - a.ts).slice(0, 8),
    [events]
  );

  return (
    <div className="home">
      <header className="bm-header">
        <div className="bm-title">
          <h1>Portfolio</h1>
          <p className="muted tiny">Robinhood-style overview · click a stock to explore its event web</p>
        </div>
        <button className="web-cta" onClick={onOpenWeb}>◕ Event Web — all stocks →</button>
      </header>

      <div className="home-hero card">
        <div className="rh-label muted">Total value</div>
        <div className="rh-value">{value != null ? usd(value) : '—'}</div>
        <div className={`rh-change ${plClass(totalPl)}`}>
          {signedUsd(totalPl)} <span className="rh-pct">{signedPct(totalPl / cost)}</span>
          <span className="muted rh-since"> all time</span>
          {day && (
            <span className={`day-chip ${plClass(day.change)}`}>
              {signedUsd(day.change)} ({signedPct(day.changePct)}) today
            </span>
          )}
        </div>
        <PortfolioChart points={points} costBasis={cost} height={230} />
      </div>

      <div className="home-cols">
        <div className="card">
          <div className="card-head"><h2>Holdings</h2><span className="muted tiny">tap to open bubble map</span></div>
          <div className="holdings-list">
            {(live?.positions || []).map((p) => (
              <button className="holding-row" key={p.symbol} onClick={() => onOpenStock(p.symbol)}>
                <div className="hr-left">
                  <div className="hr-sym">{p.symbol}</div>
                  <div className="hr-name muted tiny">{stocks[p.symbol]?.name}</div>
                </div>
                <div className="hr-val">{usd(p.value)}</div>
                <div className={`hr-day ${plClass(p.dayChange)}`}>{signedPct(p.dayChangePct)}</div>
                <div className="hr-arrow muted">›</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Recent events</h2><span className="muted tiny">the web of causes</span></div>
          <div className="feed">
            {recent.map((e) => (
              <button className="feed-row" key={e.id} onClick={() => onOpenEvent(e)}>
                <span className="feed-dot" style={{ background: tierColor(e.confidence_tier) }} />
                <div className="feed-body">
                  <div className="feed-head">{e.headline}</div>
                  <div className="muted tiny">
                    {e.date.slice(0, 10)} · {categoryLabel(e.category)} · {e.affected_tickers.join(', ')}
                  </div>
                </div>
                <div className={`feed-mag ${e.confidence_tier}`}>
                  {e.magnitude ? pct(e.magnitude / 100) : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
