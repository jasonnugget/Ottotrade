import { useMemo, useState } from 'react';
import { api, pct, usd } from '../../api.js';
import ottoResponse from './otto-response.png';
import ottoThinking from './otto-thinking.png';
import ottoWaiting from './otto-waiting.png';
import './analysis.css';

const DAY = 86_400;
const PRICE_WINDOWS = [['T-30d', -30], ['T-7d', -7], ['T-1d', -1], ['T0 event', 0], ['T+1d', 1], ['T+7d', 7], ['T+30d', 30], ['T+90d', 90]];

function impactFor(event, symbol) {
  return event?.impacts?.find((impact) => impact.ticker === symbol);
}

function closestBar(bars, target, direction) {
  if (direction === 'before') return [...bars].reverse().find((bar) => bar.t <= target);
  if (direction === 'after') return bars.find((bar) => bar.t >= target);
  return bars.reduce((closest, bar) => (!closest || Math.abs(bar.t - target) < Math.abs(closest.t - target) ? bar : closest), null);
}

function priceStudy(history, event) {
  const bars = history?.bars || [];
  return PRICE_WINDOWS.map(([label, offset]) => {
    const target = event.ts + offset * DAY;
    const bar = offset < 0 ? closestBar(bars, target, 'before') : offset > 0 ? closestBar(bars, target, 'after') : closestBar(bars, target);
    return { label, date: bar ? new Date(bar.t * 1000).toISOString().slice(0, 10) : null, close: bar?.c ?? null, highLowRangePct: bar?.c ? ((bar.h - bar.l) / bar.c) * 100 : null };
  });
}

function comparableEvents(events, event, symbol, history) {
  return events.filter((candidate) => candidate.id !== event.id && candidate.ts < event.ts && candidate.category === event.category && impactFor(candidate, symbol))
    .sort((a, b) => b.ts - a.ts).slice(0, 3).map((candidate) => {
      const impact = impactFor(candidate, symbol);
      return { date: candidate.date.slice(0, 10), headline: candidate.headline, observedImpactPct: impact?.pct_change ?? null, tier: impact?.tier, priceWindows: priceStudy(history, candidate), intradayAvailable: false };
    });
}

function PriceEvidenceChart({ study }) {
  const windows = study.selectedEvent.priceWindows;
  const values = windows.map((window) => window.close).filter((value) => value != null);
  if (!values.length) return <p className="muted tiny">No historical close data is available for this event.</p>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(max * 0.02, 1);
  const pointFor = (window, index) => ({
    x: 38 + index * (524 / Math.max(windows.length - 1, 1)),
    y: window.close == null ? null : 78 - ((window.close - min) / spread) * 52,
  });
  const points = windows.map(pointFor);
  const line = points.filter((point) => point.y != null).map((point) => `${point.x},${point.y}`).join(' ');
  const eventIndex = windows.findIndex((window) => window.label === 'T0 event');

  return <div className="analysis-chart-wrap">
    <svg className="analysis-price-chart" viewBox="0 0 600 112" role="img" aria-label={`${study.ticker} closing prices around the selected event`}>
      <line x1="38" x2="562" y1="78" y2="78" className="analysis-chart-axis" />
      <line x1={points[eventIndex]?.x} x2={points[eventIndex]?.x} y1="12" y2="82" className="analysis-chart-event" />
      {line && <polyline points={line} className="analysis-chart-line" />}
      {points.map((point, index) => point.y != null && <g key={windows[index].label}>
        <circle cx={point.x} cy={point.y} r="4.5" className={index === eventIndex ? 'analysis-chart-dot analysis-chart-dot--event' : 'analysis-chart-dot'} />
        <text x={point.x} y={point.y - 10} textAnchor="middle" className="analysis-chart-value">{usd(windows[index].close)}</text>
        <text x={point.x} y="96" textAnchor="middle" className="analysis-chart-label">{windows[index].label.replace(' event', '')}</text>
      </g>)}
    </svg>
    <div className="analysis-chart-caption"><span>Selected event: {study.selectedEvent.headline}</span><span>{study.selectedEvent.date}</span></div>
  </div>;
}

// Renders one ticker's report straight from the structured JSON Gemini returned (see
// frontend/api/analyze.js's responseSchema) — no markdown parsing involved.
function TickerReport({ report }) {
  const { ticker, executiveSummary, historicalPattern, currentEventAssessment, scores, timeHorizon, keyRisks } = report;
  return (
    <article className="analysis-report">
      <h2>{ticker} — Executive Summary</h2>
      <p>{executiveSummary}</p>

      <h3>Historical Pattern Analysis</h3>
      <div className="analysis-markdown-table">
        <table>
          <thead>
            <tr><th>Event</th><th>Baseline</th><th>Reaction</th><th>Follow-through</th><th>% Move</th><th>Recovery</th></tr>
          </thead>
          <tbody>
            {historicalPattern.rows.map((row, index) => (
              <tr key={index}>
                <td>{row.eventDate} — {row.headline}</td>
                <td>{row.baseline}</td>
                <td>{row.reaction}</td>
                <td>{row.later}</td>
                <td>{row.movePct}</td>
                <td>{row.recovery}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Avg drawdown {historicalPattern.averageDrawdownPct} · avg recovery {historicalPattern.averageRecoveryTime} · variance {historicalPattern.variance}</p>
      <p className="muted tiny">{historicalPattern.reliabilityNote}</p>

      <h3>Current Event Assessment</h3>
      <p>{currentEventAssessment}</p>

      <h3>Scores</h3>
      <div className="analysis-scorecard">
        <div><b>Risk score</b> {scores.riskScore}/100<p className="muted tiny">{scores.riskRationale}</p></div>
        <div><b>Recovery score</b> {scores.recoveryScore}/100<p className="muted tiny">{scores.recoveryRationale}</p></div>
        <div><b>{scores.signal}</b> · {scores.confidence} confidence<p className="muted tiny">{scores.signalRationale}</p></div>
      </div>

      <h3>Time Horizon Breakdown</h3>
      <ul>
        <li><strong>Short-term (1–7d):</strong> {timeHorizon.shortTerm}</li>
        <li><strong>Medium-term (1–3mo):</strong> {timeHorizon.mediumTerm}</li>
        <li><strong>Long-term (3–12mo):</strong> {timeHorizon.longTerm}</li>
      </ul>

      <h3>Key Risks & Assumptions</h3>
      <ul>{keyRisks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>
    </article>
  );
}

// Calls the server-side Gemini proxy (frontend/api/analyze.js) — the API key never
// reaches the browser, and the response is schema-validated JSON, not freeform text.
async function requestAnalysis(studies) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studies }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Analysis request failed (${response.status}).`);
  if (!Array.isArray(data?.reports) || !data.reports.length) throw new Error('Analysis returned no reports.');
  return data.reports;
}

export default function AnalysisTab({ live, events }) {
  const [step, setStep] = useState(1);
  const [symbols, setSymbols] = useState([]);
  const [eventIds, setEventIds] = useState({});
  const [reports, setReports] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const positions = live?.positions || [];
  const relevant = useMemo(() => Object.fromEntries(symbols.map((symbol) => [symbol, (events || []).filter((event) => impactFor(event, symbol)).sort((a, b) => b.ts - a.ts)])), [events, symbols]);
  const readyForReport = symbols.length > 0 && symbols.every((symbol) => eventIds[symbol]);

  const toggleSymbol = (symbol) => {
    setSymbols((current) => current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]);
    setEventIds((current) => { const next = { ...current }; delete next[symbol]; return next; });
  };

  async function createReport() {
    setError(''); setReports([]); setEvidence([]); setLoading(true);
    try {
      const studies = await Promise.all(symbols.map(async (symbol) => {
        const event = (events || []).find((item) => item.id === eventIds[symbol]);
        const history = await api.stockHistory(symbol, 'SINCE');
        const position = positions.find((item) => item.symbol === symbol);
        return {
          ticker: symbol,
          position: position ? { value: position.value, dayChangePct: position.dayChangePct, price: position.price } : null,
          selectedEvent: { date: event.date.slice(0, 10), headline: event.headline, category: event.category, observedImpact: impactFor(event, symbol), priceWindows: priceStudy(history, event) },
          priorSimilarEvents: comparableEvents(events || [], event, symbol, history),
        };
      }));
      setEvidence(studies);
      setReports(await requestAnalysis(studies));
    } catch (reportError) { setError(reportError.message || 'Unable to generate the analysis.'); } finally { setLoading(false); }
  }

  const ottoImage = loading ? ottoThinking : reports.length ? ottoResponse : ottoWaiting;
  const ottoText = loading ? 'Otto is reviewing the evidence…' : reports.length ? 'Otto’s evidence review is ready.' : 'Choose the evidence Otto should analyze.';

  return <div className="analysis-tab">
    <header className="analysis-header"><div><p className="analysis-kicker">Otto AI research flow</p><h1>Analyze event risk</h1><p className="muted tiny">Select holdings, inspect event evidence, then generate a scenario-based report.</p></div><div className="analysis-steps" aria-label="Analysis progress">{[['1', 'Stocks'], ['2', 'Evidence'], ['3', 'Report']].map(([number, label]) => <span className={step === Number(number) ? 'active' : step > Number(number) ? 'complete' : ''} key={number}>{number}<b>{label}</b></span>)}</div></header>
    <div className="analysis-workspace card"><aside className="analysis-otto" aria-live="polite"><img src={ottoImage} alt="Otto assistant" /><p>{ottoText}</p></aside><section className="analysis-panel">
      {step === 1 && <><div className="analysis-panel-heading"><span>Step 1</span><h2>Which holdings should Otto analyze?</h2><p>Choose one or more positions to compare their event exposure.</p></div><div className="analysis-stock-list">{positions.map((position) => <button type="button" className={`analysis-stock ${symbols.includes(position.symbol) ? 'selected' : ''}`} key={position.symbol} onClick={() => toggleSymbol(position.symbol)}><span className="analysis-check">{symbols.includes(position.symbol) ? '✓' : ''}</span><strong>{position.symbol}</strong><span>{usd(position.value)}</span><em className={position.dayChangePct >= 0 ? 'pos' : 'neg'}>{pct(position.dayChangePct)}</em></button>)}</div><div className="analysis-actions"><span>{symbols.length} selected</span><button type="button" disabled={!symbols.length} onClick={() => setStep(2)}>Review event evidence →</button></div></>}
      {step === 2 && <><div className="analysis-panel-heading"><span>Step 2</span><h2>Select the event evidence</h2><p>Choose one event per holding. Otto will compare its price path with prior same-category events.</p></div><div className="analysis-evidence-list">{symbols.map((symbol) => <article className="analysis-evidence" key={symbol}><h3>{symbol}</h3>{relevant[symbol]?.length ? relevant[symbol].map((event) => { const impact = impactFor(event, symbol); return <label className={eventIds[symbol] === event.id ? 'selected' : ''} key={event.id}><input type="radio" name={`event-${symbol}`} checked={eventIds[symbol] === event.id} onChange={() => setEventIds((current) => ({ ...current, [symbol]: event.id }))} /><span><b>{event.headline}</b><small>{event.date.slice(0, 10)} · {event.category} · observed move {impact?.pct_change == null ? 'not recorded' : pct(impact.pct_change / 100)}</small></span></label>; }) : <p className="muted tiny">No tracked events are available for {symbol}.</p>}</article>)}</div><div className="analysis-actions"><button type="button" className="secondary" onClick={() => setStep(1)}>← Back</button><button type="button" disabled={!readyForReport} onClick={() => { setStep(3); createReport(); }}>Generate evidence report →</button></div></>}
      {step === 3 && <><div className="analysis-panel-heading"><span>Step 3</span><h2>Event risk and recovery report</h2><p>Scores are scenario-based signals, not investment instructions.</p></div>{loading && <div className="analysis-loading"><span /> Gathering price windows, historical comparisons, and risk signals…</div>}{error && <div className="analysis-report-error">{error}</div>}{evidence.length > 0 && <section className="analysis-data-check"><h3>Observed price evidence</h3>{evidence.map((study) => <article className="analysis-chart-card" key={study.ticker}><div><b>{study.ticker}</b><span>{study.selectedEvent.date}</span></div><PriceEvidenceChart study={study} /></article>)}</section>}{reports.length > 0 && <div className="analysis-report-list">{reports.map((report) => <TickerReport report={report} key={report.ticker} />)}</div>}{!loading && !reports.length && !error && <p className="muted">Ready to generate your report.</p>}<div className="analysis-actions"><button type="button" className="secondary" disabled={loading} onClick={() => setStep(2)}>← Adjust evidence</button>{!loading && <button type="button" onClick={createReport}>Regenerate report</button>}</div></>}
    </section></div><p className="analysis-disclaimer">Educational analysis only. Historical reactions do not guarantee future outcomes.</p>
  </div>;
}
