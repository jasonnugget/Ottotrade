import { useMemo } from 'react';
import { usd, signedUsd, signedPct, plClass } from '../../api.js';

// Minimal Robinhood-style portfolio card. Big value tracks the timeline scrubber.
export default function RobinhoodPanel({ timeline, currentTs, live }) {
  const points = timeline?.points || [];

  const { value, series, atDate } = useMemo(() => {
    if (!points.length) return { value: null, series: [], atDate: null };
    const cutoff = currentTs ?? points[points.length - 1].ts;
    const shown = points.filter((p) => p.ts <= cutoff);
    const use = shown.length ? shown : [points[0]];
    return { value: use[use.length - 1].value, series: use, atDate: use[use.length - 1].date };
  }, [points, currentTs]);

  const cost = 50000;
  const pl = value != null ? value - cost : 0;
  const cls = plClass(pl);

  // SVG sparkline
  const spark = useMemo(() => {
    if (series.length < 2) return null;
    const w = 260;
    const h = 56;
    const vals = series.map((p) => p.value);
    const min = Math.min(...vals, cost);
    const max = Math.max(...vals, cost);
    const rng = max - min || 1;
    const x = (i) => (i / (series.length - 1)) * w;
    const y = (v) => h - ((v - min) / rng) * h;
    const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const costY = y(cost);
    return { w, h, d, costY, color: pl >= 0 ? '#22c55e' : '#ef4444' };
  }, [series, pl]);

  return (
    <div className="rh-panel">
      <div className="rh-label muted">Portfolio value{atDate ? ` · ${atDate}` : ''}</div>
      <div className="rh-value">{value != null ? usd(value) : '—'}</div>
      <div className={`rh-change ${cls}`}>
        {signedUsd(pl)} <span className="rh-pct">{signedPct(pl / cost)}</span>
        <span className="muted rh-since"> since inception</span>
      </div>

      {spark && (
        <svg className="rh-spark" viewBox={`0 0 ${spark.w} ${spark.h}`} preserveAspectRatio="none">
          <line x1="0" x2={spark.w} y1={spark.costY} y2={spark.costY} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
          <path d={spark.d} fill="none" stroke={spark.color} strokeWidth="2" />
        </svg>
      )}

      <div className="rh-holdings">
        {(live?.positions || []).map((p) => (
          <div className="rh-holding" key={p.symbol}>
            <div className="rh-sym">{p.symbol}</div>
            <div className="rh-price">{usd(p.price)}</div>
            <div className={`rh-day ${plClass(p.dayChange)}`}>{signedPct(p.dayChangePct)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
