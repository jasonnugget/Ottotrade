import { useState } from 'react';
import { TIER } from './theme.js';
import { useStageSize } from './graphUtils.js';
import ConnectionWeb from './ConnectionWeb.jsx';
import GeoMap from './GeoMap.jsx';
import RobinhoodPanel from './RobinhoodPanel.jsx';
import EventPanel from './EventPanel.jsx';

// All-stocks bubble map. Clicking a stock node drills into that stock.
export default function WebView({
  graph,
  visibleEvents,
  eventsById,
  selectedEvent,
  related,
  live,
  timeline,
  currentTs,
  onSelectEvent,
  onOpenStock,
  onBack,
  enrich,
}) {
  const [mode, setMode] = useState('web');
  const [stageRef, size] = useStageSize();

  const handleSelect = (node) => {
    if (!node) return onSelectEvent(null);
    if (node.type === 'stock') return onOpenStock(node.id);
    onSelectEvent({ id: node.id, type: 'event' });
  };

  return (
    <div className="webview">
      <header className="bm-header">
        <div className="bm-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>← Portfolio</button>
          <div>
            <h1>Event Web — all stocks</h1>
            <p className="muted tiny">Click a stock to drill in · a bubble to see the reasoning</p>
          </div>
        </div>
        <div className="view-tabs">
          <button className={mode === 'web' ? 'active' : ''} onClick={() => setMode('web')}>◕ Web</button>
          <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>◍ Map</button>
        </div>
      </header>

      <div className="bm-body">
        <div className="bm-stage" ref={stageRef}>
          {mode === 'web' ? (
            <ConnectionWeb graph={graph} selectedId={selectedEvent?.id} onSelect={handleSelect} width={size.w} height={size.h} />
          ) : (
            <GeoMap events={visibleEvents} selectedId={selectedEvent?.id} onSelect={handleSelect} width={size.w} height={size.h} />
          )}
          <Legend />
        </div>
        <aside className="bm-side">
          <RobinhoodPanel timeline={timeline} currentTs={currentTs} live={live} />
          {selectedEvent ? (
            <EventPanel
              event={selectedEvent}
              related={related}
              onPick={(id) => (eventsById[id] ? onSelectEvent({ id, type: 'event' }) : onOpenStock(id))}
              enrich={enrich}
            />
          ) : (
            <div className="ep-empty muted tiny">Click a bubble for its confidence tier and causal reasoning.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      {Object.entries(TIER).map(([k, v]) => (
        <div className="legend-item" key={k}>
          <svg width="22" height="8">
            <line x1="0" y1="4" x2="22" y2="4" stroke={v.color} strokeWidth="2" strokeDasharray={v.dash.join(' ')} />
          </svg>
          <span>{v.label}</span>
        </div>
      ))}
    </div>
  );
}
