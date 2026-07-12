import { useMemo } from 'react';
import { usd, signedUsd, signedPct, plClass } from '../../api.js';

// Only the biggest movers show here — as the portfolio grows this keeps the mini
// panel from needing to scroll. "More" links out to the full Portfolio tab.
const MAX_HOLDINGS_SHOWN = 5;

// Minimal Robinhood-style portfolio card. Big value tracks the timeline scrubber.
export default function RobinhoodPanel({ timeline, currentTs, live, onOpenPortfolio }) {
  const points = timeline?.points || [];

  const topMovers = useMemo(
    () =>
      [...(live?.positions || [])]
        .sort((a, b) => Math.abs(b.dayChangePct || 0) - Math.abs(a.dayChangePct || 0))
        .slice(0, MAX_HOLDINGS_SHOWN),
    [live]
  );

  const { value, series, atDate } = useMemo(() => {
    if (!points.length) return { value: null, series: [], atDate: null };
    const cutoff = currentTs ?? points[points.length - 1].ts;
    const shown = points.filter((p) => p.ts <= cutoff);
    const use = shown.length ? shown : [points[0]];
    return { value: use[use.length - 1].value, series: use, atDate: use[use.length - 1].date };
  }, [points, currentTs]);

  // Real cost basis from the user's own purchase lots — not a fixed starting balance.
  const cost = live?.costBasis ?? 0;
  const pl = value != null && cost > 0 ? value - cost : 0;
  const cls = plClass(pl);

  // SVG sparkline. The cost-basis line only participates in the scale when there IS a
  // cost basis — otherwise an empty portfolio would squash the curve against a zero axis.
  const spark = useMemo(() => {
    if (series.length < 2) return null;
    const w = 260;
    const h = 56;
    const vals = series.map((p) => p.value);
    const bounds = cost > 0 ? [...vals, cost] : vals;
    const min = Math.min(...bounds);
    const max = Math.max(...bounds);
    const rng = max - min || 1;
    const x = (i) => (i / (series.length - 1)) * w;
    const y = (v) => h - ((v - min) / rng) * h;
    const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    return { w, h, d, costY: cost > 0 ? y(cost) : null, color: pl >= 0 ? '#22c55e' : '#ef4444' };
  }, [series, pl, cost]);

  return (
    <div className="rh-panel">
      <div className="rh-main">
        <div className="rh-label muted">Portfolio value{atDate ? ` · ${atDate}` : ''}</div>
        <div className="rh-value">{value != null ? usd(value) : '—'}</div>
        <div className={`rh-change ${cls}`}>
          {signedUsd(pl)} <span className="rh-pct">{signedPct(cost > 0 ? pl / cost : 0)}</span>
          <span className="muted rh-since"> since inception</span>
        </div>

        {spark && (
          <svg className="rh-spark" viewBox={`0 0 ${spark.w} ${spark.h}`} preserveAspectRatio="none">
            {spark.costY != null && (
              <line x1="0" x2={spark.w} y1={spark.costY} y2={spark.costY} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
            )}
            <path d={spark.d} fill="none" stroke={spark.color} strokeWidth="2" />
          </svg>
        )}
      </div>

      <div className="rh-holdings">
        {topMovers.map((p) => (
          <div className="rh-holding" key={p.symbol}>
            <div className="rh-sym">{p.symbol}</div>
            <div className="rh-price">{usd(p.price)}</div>
            <div className={`rh-day ${plClass(p.dayChange)}`}>{signedPct(p.dayChangePct)}</div>
          </div>
        ))}
        <button className="rh-more" onClick={onOpenPortfolio}>more</button>
      </div>
    </div>
  );
}
