import { useMemo, useState } from 'react';
import { api, pct, usd } from '../../api.js';
import ottoResponse from './otto-response.png';
import ottoThinking from './otto-thinking.png';
import ottoWaiting from './otto-waiting.png';
import './guidance.css';

const DAY = 86_400;
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';
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

function inlineText(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part
  ));
}

function FormattedReport({ text }) {
  const blocks = [];
  let list = [];
  let table = [];
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list });
    list = [];
  };
  const flushTable = () => {
    if (table.length) blocks.push({ type: 'table', rows: table });
    table = [];
  };

  text.split('\n').forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    const isTableRow = line.includes('|') && line.split('|').length >= 3;
    const isDivider = /^\s*\|?\s*:?-{3,}/.test(line);
    if (isTableRow) {
      flushList();
      if (!isDivider) table.push(line.split('|').map((cell) => cell.trim()).filter(Boolean));
    } else if (heading) {
      flushTable();
      flushList();
      blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
    } else if (bullet) {
      flushTable();
      list.push(bullet[1]);
    } else if (line.trim()) {
      flushTable();
      flushList();
      blocks.push({ type: 'p', text: line });
    } else {
      flushTable();
      flushList();
    }
  });
  flushTable();
  flushList();

  return <>{blocks.map((block, index) => {
    if (block.type === 'list') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineText(item)}</li>)}</ul>;
    if (block.type === 'table') return <div className="guidance-markdown-table" key={index}><table><thead><tr>{block.rows[0].map((cell, cellIndex) => <th key={cellIndex}>{inlineText(cell)}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineText(cell)}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === 'h1') return <h2 key={index}>{inlineText(block.text)}</h2>;
    if (block.type === 'h2') return <h3 key={index}>{inlineText(block.text)}</h3>;
    if (block.type === 'h3') return <h4 key={index}>{inlineText(block.text)}</h4>;
    return <p key={index}>{inlineText(block.text)}</p>;
  })}</>;
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

  return <div className="guidance-chart-wrap">
    <svg className="guidance-price-chart" viewBox="0 0 600 112" role="img" aria-label={`${study.ticker} closing prices around the selected event`}>
      <line x1="38" x2="562" y1="78" y2="78" className="guidance-chart-axis" />
      <line x1={points[eventIndex]?.x} x2={points[eventIndex]?.x} y1="12" y2="82" className="guidance-chart-event" />
      {line && <polyline points={line} className="guidance-chart-line" />}
      {points.map((point, index) => point.y != null && <g key={windows[index].label}>
        <circle cx={point.x} cy={point.y} r="4.5" className={index === eventIndex ? 'guidance-chart-dot guidance-chart-dot--event' : 'guidance-chart-dot'} />
        <text x={point.x} y={point.y - 10} textAnchor="middle" className="guidance-chart-value">{usd(windows[index].close)}</text>
        <text x={point.x} y="96" textAnchor="middle" className="guidance-chart-label">{windows[index].label.replace(' event', '')}</text>
      </g>)}
    </svg>
    <div className="guidance-chart-caption"><span>Selected event: {study.selectedEvent.headline}</span><span>{study.selectedEvent.date}</span></div>
  </div>;
}

async function generateAnalysis(payload) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini is not configured. Add VITE_GEMINI_API_KEY to frontend/.env.local.');
  const prompt = `You are Otto, an evidence-first equity event analyst. Produce educational, non-personalized research from ONLY the supplied data. Do not invent prices or events, and label missing/insufficient evidence.

For each ticker, return this structured Markdown report:
## TICKER — Executive Summary
Write a 3–4 sentence plain-language verdict. Distinguish historical evidence from inference.
### Historical Pattern Analysis
Create a compact Markdown table: event date | T-30d/T-7d/T-1d baseline | T0/next-day reaction | T+7d/T+30d/T+90d | % move/high-low range | recovery to baseline and time. Use "not available" for missing windows. Intraday data is not supplied; daily high-low range is only a volatility proxy.
Then identify average drawdown, average recovery time, variance, and whether fewer than 3 comparables make the pattern unreliable.
### Current Event Assessment
Compare the current event’s type/severity with the supplied historical set. Do not add unsupplied market or sector factors.
### Scores
Give **Risk Score (0–100)**, **Recovery Score (0–100)**, and **Buy/Sell/Hold research signal** with Low/Medium/High confidence. Give a one-sentence historical-data rationale for each. The signal is educational research, not personalized investment advice.
### Time Horizon Breakdown
- **Short-term (1–7d):** historical pattern suggests…
- **Medium-term (1–3mo):** historical pattern suggests…
- **Long-term (3–12mo):** historical evidence is / is not available…
### Key Risks & Assumptions
State what could invalidate the analysis and all missing data. Do not present a score or historical pattern as a guarantee.

Analysis data:\n${JSON.stringify(payload, null, 2)}`;
  const body = JSON.stringify({ system_instruction: { parts: [{ text: 'Be skeptical, precise, and transparent about uncertainty. Use only supplied data and never fabricate missing price windows.' }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1800 } });
  const models = [...new Set([MODEL, 'gemini-3-flash-preview'])];
  const requiredSections = ['Historical Pattern Analysis', 'Scores', 'Time Horizon Breakdown', 'Key Risks'];
  let lastError = 'No response received.';

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryPrompt = attempt
        ? `${prompt}\n\nIMPORTANT: Your prior response was incomplete. Return every required section, even when the correct value is "not available" or "insufficient data." Do not stop after the executive summary.`
        : prompt;
      const attemptBody = attempt ? JSON.stringify({ system_instruction: { parts: [{ text: 'Be skeptical, precise, and transparent about uncertainty. Use only supplied data and never fabricate missing price windows.' }] }, contents: [{ role: 'user', parts: [{ text: retryPrompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2500 } }) : body;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: attemptBody,
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
        if (text && requiredSections.every((section) => text.includes(section))) return text;
        lastError = text ? `${model} returned an incomplete report.` : `${model} returned an empty response.`;
        continue;
      }

      const errorBody = await response.text();
      lastError = `${model} (${response.status}): ${errorBody.slice(0, 140)}`;
      if (response.status !== 429 && response.status !== 503) break;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }

  throw new Error(`Gemini is temporarily unavailable. ${lastError}`);
}

export default function GuidanceTab({ live, events }) {
  const [step, setStep] = useState(1);
  const [symbols, setSymbols] = useState([]);
  const [eventIds, setEventIds] = useState({});
  const [report, setReport] = useState('');
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
    setError(''); setReport(''); setEvidence([]); setLoading(true);
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
      setReport(await generateAnalysis({ generatedAt: new Date().toISOString(), studies }));
    } catch (reportError) { setError(reportError.message || 'Unable to generate the analysis.'); } finally { setLoading(false); }
  }

  const ottoImage = loading ? ottoThinking : report ? ottoResponse : ottoWaiting;
  const ottoText = loading ? 'Otto is reviewing the evidence…' : report ? 'Otto’s evidence review is ready.' : 'Choose the evidence Otto should analyze.';

  return <div className="guidance-tab">
    <header className="guidance-header"><div><p className="guidance-kicker">Otto AI research flow</p><h1>Analyze event risk</h1><p className="muted tiny">Select holdings, inspect event evidence, then generate a scenario-based report.</p></div><div className="guidance-steps" aria-label="Analysis progress">{[['1', 'Stocks'], ['2', 'Evidence'], ['3', 'Report']].map(([number, label]) => <span className={step === Number(number) ? 'active' : step > Number(number) ? 'complete' : ''} key={number}>{number}<b>{label}</b></span>)}</div></header>
    <div className="guidance-workspace card"><aside className="guidance-otto" aria-live="polite"><img src={ottoImage} alt="Otto assistant" /><p>{ottoText}</p></aside><section className="guidance-panel">
      {step === 1 && <><div className="guidance-panel-heading"><span>Step 1</span><h2>Which holdings should Otto analyze?</h2><p>Choose one or more positions to compare their event exposure.</p></div><div className="guidance-stock-list">{positions.map((position) => <button type="button" className={`guidance-stock ${symbols.includes(position.symbol) ? 'selected' : ''}`} key={position.symbol} onClick={() => toggleSymbol(position.symbol)}><span className="guidance-check">{symbols.includes(position.symbol) ? '✓' : ''}</span><strong>{position.symbol}</strong><span>{usd(position.value)}</span><em className={position.dayChangePct >= 0 ? 'pos' : 'neg'}>{pct(position.dayChangePct)}</em></button>)}</div><div className="guidance-actions"><span>{symbols.length} selected</span><button type="button" disabled={!symbols.length} onClick={() => setStep(2)}>Review event evidence →</button></div></>}
      {step === 2 && <><div className="guidance-panel-heading"><span>Step 2</span><h2>Select the event evidence</h2><p>Choose one event per holding. Otto will compare its price path with prior same-category events.</p></div><div className="guidance-evidence-list">{symbols.map((symbol) => <article className="guidance-evidence" key={symbol}><h3>{symbol}</h3>{relevant[symbol]?.length ? relevant[symbol].map((event) => { const impact = impactFor(event, symbol); return <label className={eventIds[symbol] === event.id ? 'selected' : ''} key={event.id}><input type="radio" name={`event-${symbol}`} checked={eventIds[symbol] === event.id} onChange={() => setEventIds((current) => ({ ...current, [symbol]: event.id }))} /><span><b>{event.headline}</b><small>{event.date.slice(0, 10)} · {event.category} · observed move {impact?.pct_change == null ? 'not recorded' : pct(impact.pct_change / 100)}</small></span></label>; }) : <p className="muted tiny">No tracked events are available for {symbol}.</p>}</article>)}</div><div className="guidance-actions"><button type="button" className="secondary" onClick={() => setStep(1)}>← Back</button><button type="button" disabled={!readyForReport} onClick={() => { setStep(3); createReport(); }}>Generate evidence report →</button></div></>}
      {step === 3 && <><div className="guidance-panel-heading"><span>Step 3</span><h2>Event risk and recovery report</h2><p>Scores are scenario-based signals, not investment instructions.</p></div>{loading && <div className="guidance-loading"><span /> Gathering price windows, historical comparisons, and risk signals…</div>}{error && <div className="guidance-report-error">{error}</div>}{evidence.length > 0 && <section className="guidance-data-check"><h3>Observed price evidence</h3>{evidence.map((study) => <article className="guidance-chart-card" key={study.ticker}><div><b>{study.ticker}</b><span>{study.selectedEvent.date}</span></div><PriceEvidenceChart study={study} /></article>)}</section>}{report && <article className="guidance-report"><FormattedReport text={report} /></article>}{!loading && !report && !error && <p className="muted">Ready to generate your report.</p>}<div className="guidance-actions"><button type="button" className="secondary" disabled={loading} onClick={() => setStep(2)}>← Adjust evidence</button>{!loading && <button type="button" onClick={createReport}>Regenerate report</button>}</div></>}
    </section></div><p className="guidance-disclaimer">Educational analysis only. Historical reactions do not guarantee future outcomes.</p>
  </div>;
}
