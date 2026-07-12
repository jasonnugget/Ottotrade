import { TIER } from '../../shared/theme.js';
import { useStageSize } from '../../shared/graphUtils.js';
import ConnectionWeb from '../../shared/ConnectionWeb.jsx';
import EventPanel from '../../shared/EventPanel.jsx';
import RobinhoodPanel from './RobinhoodPanel.jsx';
import './home.css';

// All-stocks bubble map — the "event web". Clicking a stock node drills into Explore;
// clicking an event bubble swaps the portfolio chart/holdings out for that event's
// reasoning in a side panel next to the map.
export default function HomeTab({
  graph,
  eventsById,
  selectedEvent,
  related,
  live,
  timeline,
  currentTs,
  onSelectEvent,
  onOpenStock,
  onOpenPortfolio,
  enrich,
}) {
  const [stageRef, size] = useStageSize();

  const handleSelect = (node) => {
    if (!node) return onSelectEvent(null);
    if (node.type === 'stock') return onOpenStock(node.id);
    onSelectEvent({ id: node.id, type: 'event' });
  };

  return (
    <div className="webview">
      <header className="bm-header">
        <div className="bm-title">
          <h1>Home</h1>
          <p className="muted tiny"></p>
        </div>
      </header>

      <div className={`bm-body${selectedEvent ? ' with-side' : ''}`}>
        <div className="bm-stage" ref={stageRef}>
          <ConnectionWeb graph={graph} selectedId={selectedEvent?.id} onSelect={handleSelect} width={size.w} height={size.h} />
          <Legend />
        </div>
        {selectedEvent && (
          <aside className="bm-side">
            <EventPanel
              event={selectedEvent}
              related={related}
              onPick={(id) => (eventsById[id] ? onSelectEvent({ id, type: 'event' }) : onOpenStock(id))}
              enrich={enrich}
            />
          </aside>
        )}
      </div>

      {!selectedEvent && (
        <div className="bm-footer">
          <RobinhoodPanel timeline={timeline} currentTs={currentTs} live={live} onOpenPortfolio={onOpenPortfolio} />
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      {Object.entries(TIER)
        .filter(([k]) => k !== 'unrelated')
        .map(([k, v]) => (
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
