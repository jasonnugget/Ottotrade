import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { usd, usd0 } from '../api.js';

// Portfolio total value over time (daily), with a cost-basis reference line.
export default function ValueChart({ series, costBasis, snapshotDate }) {
  if (!series?.length) return null;
  const data = series.map((p) => ({ date: p.date, value: p.value }));
  const up = data[data.length - 1].value >= costBasis;
  const color = up ? '#16a34a' : '#dc2626';

  return (
    <section className="card">
      <div className="card-head">
        <h2>Portfolio Value Over Time</h2>
        <span className="muted">daily · since inception</span>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" minTickGap={40} tick={{ fontSize: 11 }} />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={usd0}
              width={70}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(v) => usd(v)} labelStyle={{ color: '#111' }} />
            <ReferenceLine
              y={costBasis}
              stroke="#888"
              strokeDasharray="4 4"
              label={{ value: `cost ${usd0(costBasis)}`, position: 'insideTopLeft', fontSize: 11 }}
            />
            {snapshotDate && (
              <ReferenceLine x={snapshotDate} stroke="#3b82f6" strokeDasharray="2 2" label={{ value: 'Mar 2', fontSize: 11 }} />
            )}
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#valueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
