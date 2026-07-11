import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { api, usd } from '../../api.js';

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'SINCE'];

// TradingView Lightweight Charts price panel for a selected stock, with buy/snapshot markers.
export default function StockDetail({ symbol, name }) {
  const el = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [tf, setTf] = useState('SINCE');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!el.current) return;
    const chart = createChart(el.current, {
      height: 380,
      layout: { background: { color: 'transparent' }, textColor: '#8b97b0', fontSize: 10, attributionLogo: false },
      grid: { horzLines: { color: 'rgba(255,255,255,0.05)' }, vertLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: '#38bdf8',
      topColor: 'rgba(56,189,248,0.3)',
      bottomColor: 'rgba(56,189,248,0)',
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.current.clientWidth }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .stockHistory(symbol, tf)
      .then((d) => {
        if (!alive || !seriesRef.current) return;
        const seen = new Set();
        const data = [];
        for (const b of d.bars) {
          const time = new Date(b.t * 1000).toISOString().slice(0, 10);
          if (seen.has(time)) continue;
          seen.add(time);
          data.push({ time, value: b.c });
        }
        seriesRef.current.setData(data);
        seriesRef.current.setMarkers(
          (d.markers || []).map((m) => ({
            time: new Date(m.ts * 1000).toISOString().slice(0, 10),
            position: 'aboveBar',
            color: m.type === 'purchase' ? '#22c55e' : '#f59e0b',
            shape: m.type === 'purchase' ? 'arrowUp' : 'circle',
            text: m.label,
          }))
        );
        chartRef.current?.timeScale().fitContent();
        setMeta(d);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [symbol, tf]);

  return (
    <div className="stock-detail">
      <div className="sd-head">
        <h3>
          {symbol} <span className="muted">{name}</span>
        </h3>
        <div className="tf-toggle">
          {TIMEFRAMES.map((t) => (
            <button key={t} className={t === tf ? 'active' : ''} onClick={() => setTf(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div ref={el} className="sd-chart" />
      <a
        className="chart-attribution"
        href="https://www.tradingview.com/"
        target="_blank"
        rel="noreferrer"
      >
        Charts by TradingView
      </a>
      {error && <div className="tiny neg">Error: {error}</div>}
      {meta && (
        <div className="muted tiny">
          Buy {usd(meta.buyPrice)} · interval {meta.interval} · ● bought ● Mar 2 snapshot
        </div>
      )}
    </div>
  );
}
