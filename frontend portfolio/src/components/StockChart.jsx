import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import { api, usd, pct, signedPct, plClass } from '../api.js';

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'SINCE'];

function fmtTs(t, intraday) {
  const d = new Date(t * 1000);
  return intraday
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Per-stock price chart with timeframe handling and buy/snapshot markers.
export default function StockChart({ symbol, buyPrice }) {
  const [tf, setTf] = useState('SINCE');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const load = (showSpinner) => {
      if (showSpinner) setLoading(true);
      return api
        .stockHistory(symbol, tf)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setUpdatedAt(new Date());
        })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    };
    load(true);
    // Auto-refresh the visible timeframe so the chart tracks the current moment.
    const id = setInterval(() => load(false), 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbol, tf]);

  const intraday = data && ['5m', '30m', '15m', '1h', '2m', '60m', '90m'].includes(data.interval);
  const bars = data?.bars || [];
  const chartData = bars.map((b) => ({ t: b.t, c: b.c, label: fmtTs(b.t, intraday) }));

  const first = bars[0]?.c;
  const last = bars[bars.length - 1]?.c;
  const chg = first != null && last != null ? (last - first) / first : null;

  return (
    <div className="card stock-card">
      <div className="card-head">
        <h3>
          {symbol}{' '}
          {last != null && <span className="muted">{usd(last)}</span>}{' '}
          {chg != null && <span className={`chip ${plClass(chg)}`}>{signedPct(chg)}</span>}
        </h3>
        <div className="tf-toggle">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              className={t === tf ? 'active' : ''}
              onClick={() => setTf(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 240 }}>
        {loading && <div className="placeholder">Loading {symbol} {tf}…</div>}
        {error && <div className="placeholder err">Error: {error}</div>}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="label" minTickGap={40} tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `$${v.toFixed(0)}`} width={52} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => usd(v)} labelFormatter={(l) => l} />
              <Line type="monotone" dataKey="c" stroke="#2563eb" strokeWidth={1.8} dot={false} />
              {(data.markers || []).map((m) => (
                <ReferenceDot
                  key={m.type}
                  x={fmtTs(m.ts, intraday)}
                  y={m.price}
                  r={5}
                  fill={m.type === 'purchase' ? '#16a34a' : '#f59e0b'}
                  stroke="#fff"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="placeholder">No data for {tf}.</div>
        )}
      </div>

      <div className="stock-foot muted tiny">
        Buy {usd(buyPrice)} · interval {data?.interval || '—'} ·{' '}
        {updatedAt ? `upd ${updatedAt.toLocaleTimeString()} · ` : ''}
        {data?.markers?.length ? (
          <>
            <span className="dot green" /> bought{' '}
            <span className="dot amber" /> Mar 2 snapshot
          </>
        ) : (
          'markers show when Feb 23 / Mar 2 are in range'
        )}
      </div>
    </div>
  );
}
