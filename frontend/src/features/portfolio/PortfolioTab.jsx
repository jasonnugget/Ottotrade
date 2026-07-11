import { usd, signedUsd, signedPct, plClass } from '../../api.js';
import PortfolioChart from './PortfolioChart.jsx';
import './portfolio.css';

// Robinhood-style portfolio dashboard: value, chart, clickable holdings.
export default function PortfolioTab({ live, timeline, stocks, onOpenStock, onOpenWeb }) {
  const points = timeline?.points || [];
  const value = live?.currentValue ?? (points.length ? points[points.length - 1].value : null);
  const cost = live?.costBasis ?? 50000;
  const totalPl = value != null ? value - cost : 0;
  const day = live?.windows?.day;

  return (
    <div className="home">
      <header className="port-header">
        <div className="port-title">
          <h1>Portfolio</h1>
          <p className="muted tiny">Robinhood-style overview · click a stock to explore its event web</p>
        </div>
        <button className="web-cta" onClick={onOpenWeb}>◕ Home — event web →</button>
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
    </div>
  );
}
