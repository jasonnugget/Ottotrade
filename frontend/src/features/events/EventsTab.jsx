import { useMemo, useState } from 'react';
import { pct } from '../../api.js';
import { TIER, tierColor, categoryLabel } from '../../shared/theme.js';
import './events.css';

const FILTERS = ['all', 'direct', 'indirect', 'unrelated'];

// Dedicated, filterable feed of every event — a starting scaffold for the Events
// owner to redesign. Clicking a row drills into that event's stock in Explore.
export default function EventsTab({ events, onOpenEvent }) {
  const [filter, setFilter] = useState('all');

  const sorted = useMemo(() => {
    const list = [...(events || [])].sort((a, b) => b.ts - a.ts);
    return filter === 'all' ? list : list.filter((e) => e.confidence_tier === filter);
  }, [events, filter]);

  return (
    <div className="events-tab">
      <header className="events-header">
        <div>
          <h1>Events</h1>
          <p className="muted tiny">Every event behind a portfolio move — tap one to see the reasoning</p>
        </div>
        <div className="events-filters">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : TIER[f]?.label || f}
            </button>
          ))}
        </div>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>{sorted.length} event{sorted.length === 1 ? '' : 's'}</h2>
        </div>
        <div className="feed">
          {sorted.map((e) => (
            <button className="feed-row" key={e.id} onClick={() => onOpenEvent(e)}>
              <span className="feed-dot" style={{ background: tierColor(e.confidence_tier) }} />
              <div className="feed-body">
                <div className="feed-head">{e.headline}</div>
                <div className="muted tiny">
                  {e.date.slice(0, 10)} · {categoryLabel(e.category)} · {e.affected_tickers.join(', ')}
                </div>
              </div>
              <div className={`feed-mag ${e.confidence_tier}`}>
                {e.magnitude ? pct(e.magnitude / 100) : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
