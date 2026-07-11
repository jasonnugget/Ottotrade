import { CATEGORY, tierColor } from './theme.js';

// Secondary geographic view: event bubbles at real lat/lon on an equirectangular grid,
// with connectors to a "market" hub (NYSE). No external tiles/tokens — pure SVG.
const HUB = { lat: 40.7069, lon: -74.0113, name: 'Portfolio / NYSE' };
const REGIONS = [
  { name: 'N. America', lat: 40, lon: -100 },
  { name: 'Europe', lat: 50, lon: 10 },
  { name: 'Middle East', lat: 27, lon: 45 },
  { name: 'Asia', lat: 30, lon: 100 },
];

export default function GeoMap({ events, selectedId, onSelect, width, height }) {
  const W = width || 800;
  const H = height || 500;
  const px = (lon) => ((lon + 180) / 360) * W;
  const py = (lat) => ((90 - lat) / 180) * H;

  const hub = { x: px(HUB.lon), y: py(HUB.lat) };

  return (
    <svg className="geomap" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect x="0" y="0" width={W} height={H} fill="#0b1020" />
      {/* graticule */}
      {[-120, -60, 0, 60, 120].map((lon) => (
        <line key={`v${lon}`} x1={px(lon)} y1="0" x2={px(lon)} y2={H} stroke="rgba(255,255,255,0.05)" />
      ))}
      {[-60, -30, 0, 30, 60].map((lat) => (
        <line key={`h${lat}`} x1="0" y1={py(lat)} x2={W} y2={py(lat)} stroke="rgba(255,255,255,0.05)" />
      ))}
      {REGIONS.map((r) => (
        <text key={r.name} x={px(r.lon)} y={py(r.lat)} className="geo-region" textAnchor="middle">
          {r.name}
        </text>
      ))}

      {/* edges: event -> hub */}
      {events.map((e) => {
        const x = px(e.location.lon);
        const y = py(e.location.lat);
        return (
          <line
            key={`l${e.id}`}
            x1={x}
            y1={y}
            x2={hub.x}
            y2={hub.y}
            stroke={tierColor(e.confidence_tier)}
            strokeWidth={selectedId ? (e.id === selectedId ? 1.8 : 0.4) : 0.8}
            strokeOpacity={selectedId ? (e.id === selectedId ? 0.9 : 0.15) : 0.5}
          />
        );
      })}

      {/* hub node */}
      <circle cx={hub.x} cy={hub.y} r="8" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
      <text x={hub.x} y={hub.y - 12} className="geo-hub" textAnchor="middle">
        {HUB.name}
      </text>

      {/* event bubbles */}
      {events.map((e) => {
        const x = px(e.location.lon);
        const y = py(e.location.lat);
        const r = 4 + Math.min(11, (e.magnitude || 0) * 1.4);
        const sel = e.id === selectedId;
        return (
          <g key={e.id} onClick={() => onSelect({ id: e.id, type: 'event' })} style={{ cursor: 'pointer' }}>
            {sel && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#e2e8f0" strokeWidth="1.5" />}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={tierColor(e.confidence_tier)}
              fillOpacity="0.85"
              stroke={CATEGORY[e.category] || '#94a3b8'}
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}
