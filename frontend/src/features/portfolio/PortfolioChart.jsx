import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

// Robinhood-style area chart of total portfolio value over time. costBasis comes from the
// user's real purchase lots (0 for an empty portfolio) — there is no default starting balance.
export default function PortfolioChart({ points, costBasis = 0, height = 240 }) {
  const el = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLineRef = useRef(null);

  useEffect(() => {
    if (!el.current) return;
    const chart = createChart(el.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: '#8a8f96', fontSize: 11, attributionLogo: false },
      grid: { horzLines: { color: 'rgba(255,255,255,0.05)' }, vertLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: '#22c55e',
      topColor: 'rgba(34,197,94,0.28)',
      bottomColor: 'rgba(34,197,94,0)',
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
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const seen = new Set();
    const data = [];
    for (const p of points || []) {
      if (seen.has(p.date)) continue;
      seen.add(p.date);
      data.push({ time: p.date, value: p.value });
    }
    series.setData(data);

    // The cost line is recreated whenever the basis changes (adding or selling a stock
    // moves it), so the previous one has to be removed or they stack up on the chart.
    if (priceLineRef.current) {
      series.removePriceLine?.(priceLineRef.current);
      priceLineRef.current = null;
    }
    if (!data.length) return;

    const up = data[data.length - 1].value >= costBasis;
    series.applyOptions({
      lineColor: up ? '#22c55e' : '#ef4444',
      topColor: up ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)',
      bottomColor: up ? 'rgba(34,197,94,0)' : 'rgba(239,68,68,0)',
    });

    if (costBasis > 0) {
      priceLineRef.current = series.createPriceLine?.({
        price: costBasis,
        color: '#64748b',
        lineStyle: 2,
        lineWidth: 1,
        axisLabelVisible: true,
        title: 'cost',
      });
    }
    chartRef.current?.timeScale().fitContent();
  }, [points, costBasis]);

  return (
    <div style={{ width: '100%' }}>
      <div ref={el} style={{ width: '100%' }} />
      <a
        className="chart-attribution"
        href="https://www.tradingview.com/"
        target="_blank"
        rel="noreferrer"
      >
        Charts by TradingView
      </a>
    </div>
  );
}
