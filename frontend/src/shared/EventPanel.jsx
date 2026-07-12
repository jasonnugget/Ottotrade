import { TIER, categoryLabel, tierColor, dirColor } from './theme.js';
import { pct } from '../api.js';

// Explainability panel: confidence tiers + causal reasoning for a selected event.
// showAi=false hides the Gemini generate-reasoning block — Explore's single-stock pages
// opt out of it, since the curated reasoning is the point there.
export default function EventPanel({ event, related, onPick, enrich, showAi = true }) {
  if (!event) return null;
  const { available, result, loading, error, run } = enrich || {};

  return (
    <div className="event-panel">
      <div className="ep-cat" style={{ color: tierColor(event.confidence_tier) }}>
        {categoryLabel(event.category)}
      </div>
      <h3 className="ep-headline">{event.headline}</h3>
      <div className="muted tiny ep-meta">
        {event.date.slice(0, 10)} · {event.location?.name}
        {event.source?.url && (
          <>
            {' · '}
            <a href={event.source.url} target="_blank" rel="noreferrer">
              {event.source.outlet || 'source'}
            </a>
          </>
        )}
      </div>

      <div className="ep-impacts">
        {event.impacts.map((im) => (
          <div className="ep-impact" key={im.ticker} onClick={() => onPick?.(im.ticker)}>
            <div className="ep-impact-head">
              <span className="ep-ticker">{im.ticker}</span>
              <span className="ep-tier" style={{ background: tierColor(im.tier) }}>
                {TIER[im.tier]?.label || im.tier}
              </span>
              {im.pct_change != null && (
                <span className="ep-move" style={{ color: dirColor(im.direction) }}>
                  {im.pct_change >= 0 ? '▲' : '▼'} {pct(Math.abs(im.pct_change) / 100)}
                </span>
              )}
            </div>
            <div className="ep-reasoning">{im.reasoning}</div>
          </div>
        ))}
      </div>

      {related?.length > 0 && (
        <div className="ep-related">
          <div className="muted tiny">Similar past events — what could happen next</div>
          {related.map((r) => (
            <button key={r.id} className="ep-related-btn" onClick={() => onPick?.(r.id)}>
              <span className="dot" style={{ background: tierColor(r.confidence_tier) }} /> {r.headline}
            </button>
          ))}
        </div>
      )}

      {showAi && (
        <div className="ep-ai">
          <button className="ai-btn" disabled={loading} onClick={() => run(event.id)}>
            {loading ? 'Generating…' : '✦ Generate reasoning with Gemini'}
          </button>
          {!available && !result && (
            <div className="muted tiny ep-ai-note">
              Set <code>GEMINI_API_KEY</code> on the backend to generate live. Curated reasoning shown above.
            </div>
          )}
          {error && <div className="tiny neg">{error}</div>}
          {result && (
            <div className="ep-ai-result">
              <div className="muted tiny">Gemini ({result.model}) · {result.confidence_tier}</div>
              {result.impacts.map((im) => (
                <div className="ep-impact" key={im.ticker}>
                  <div className="ep-impact-head">
                    <span className="ep-ticker">{im.ticker}</span>
                    <span className="ep-tier" style={{ background: tierColor(im.tier) }}>
                      {TIER[im.tier]?.label || im.tier}
                    </span>
                  </div>
                  <div className="ep-reasoning">{im.reasoning}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
