import { usd, signedUsd, signedPct, plClass } from '../api.js';

// Overall portfolio P/L tracker with day / week / month / year windows.
export default function PLTracker({ pl, marketState }) {
  if (!pl) return null;
  const windows = ['day', 'week', 'month', 'year'];
  const asOf = pl.asOf ? new Date(pl.asOf).toLocaleString() : '';

  return (
    <section className="card">
      <div className="card-head">
        <h2>Portfolio P/L Tracker {pl.live && <span className="chip live-chip">LIVE</span>}</h2>
        <span className="muted">
          {marketState ? `${marketState} · ` : ''}as of {asOf}
        </span>
      </div>

      <div className="hero">
        <div>
          <div className="muted">Current value</div>
          <div className="hero-value">{usd(pl.currentValue)}</div>
        </div>
        <div>
          <div className="muted">Cost basis</div>
          <div className="hero-sub">{usd(pl.costBasis)}</div>
        </div>
        <div>
          <div className="muted">Total P/L (since inception)</div>
          <div className={`hero-sub ${plClass(pl.totalPl)}`}>
            {signedUsd(pl.totalPl)} <span className="chip">{signedPct(pl.totalPlPct)}</span>
          </div>
        </div>
      </div>

      <div className="windows">
        {windows.map((w) => {
          const x = pl.windows[w];
          return (
            <div className="window" key={w}>
              <div className="window-label">{w.toUpperCase()}</div>
              <div className={`window-change ${plClass(x.change)}`}>{signedUsd(x.change)}</div>
              <div className={`window-pct ${plClass(x.change)}`}>{signedPct(x.changePct)}</div>
              <div className="muted tiny">
                {x.basis
                  ? `vs ${x.basis}`
                  : x.clampedToInception
                  ? `since ${x.fromDate}`
                  : `since ${x.fromDate}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
