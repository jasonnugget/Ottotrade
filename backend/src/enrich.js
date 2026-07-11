// Optional AI reasoning enrichment via the Google Gemini API.
//
// The seed events ship with curated, accurate reasoning so the demo always works offline.
// This module lets you (re)generate the confidence tier + causal chain + related events for
// any event using Gemini structured output — proving the "AI generates the reasoning" claim.
// It is a no-op with a clear message when no Gemini API key is configured.
//
// Set GEMINI_API_KEY (or GOOGLE_API_KEY). Model override: GEMINI_MODEL (default gemini-2.5-flash).

import { STOCKS } from './events/seed.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Gemini responseSchema (OpenAPI subset — uppercase Type enums).
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    confidence_tier: { type: 'STRING', enum: ['direct', 'indirect', 'unrelated'] },
    impacts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ticker: { type: 'STRING' },
          tier: { type: 'STRING', enum: ['direct', 'indirect', 'unrelated'] },
          direction: { type: 'STRING', enum: ['up', 'down', 'none'] },
          reasoning: { type: 'STRING' },
        },
        required: ['ticker', 'tier', 'direction', 'reasoning'],
        propertyOrdering: ['ticker', 'tier', 'direction', 'reasoning'],
      },
    },
    related_event_ids: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['confidence_tier', 'impacts', 'related_event_ids'],
  propertyOrdering: ['confidence_tier', 'impacts', 'related_event_ids'],
};

const SYSTEM = `You are a financial-causality analyst for a portfolio event map. For a news event and a
set of portfolio tickers, decide for EACH affected ticker whether the event's link to that stock is:
- "direct": a mechanical/business causal link (e.g. oil price -> ExxonMobil revenue). High confidence.
- "indirect": a macro/sentiment chain (e.g. oil spike -> inflation fear -> rate fear -> tech selloff).
  Medium confidence. The reasoning MUST spell out the causal chain step by step.
- "unrelated": the stock moved the same day but the real cause is something else entirely; linking it
  to this headline would be false pattern-matching. Say what the real driver likely was.
Be precise and skeptical. Do not blame the biggest headline of the day by default. One impact per ticker.`;

export function enrichmentAvailable() {
  return Boolean(API_KEY);
}

// Generate reasoning for one event via Gemini. `event` is a seed/enriched event object.
export async function enrichEvent(event) {
  if (!enrichmentAvailable()) {
    const err = new Error(
      'AI enrichment unavailable: set GEMINI_API_KEY to generate reasoning live. Curated reasoning is used otherwise.'
    );
    err.code = 'NO_API_KEY';
    throw err;
  }

  const impacts = event.impacts || event.affected_tickers.map((t) => ({ ticker: t }));
  const universe = impacts
    .map((i) => `${i.ticker} (${STOCKS[i.ticker]?.name} — ${STOCKS[i.ticker]?.sector})`)
    .join('; ');
  const reactions = impacts
    .map((i) => (i.pct_change != null ? `${i.ticker}: ${i.pct_change.toFixed(1)}% that day` : null))
    .filter(Boolean)
    .join('; ');

  const user = `Event: "${event.headline}"
Date: ${event.date}
Category: ${event.category}
Location: ${event.location?.name || 'n/a'}
Affected tickers: ${universe}
Observed price reactions: ${reactions || 'n/a'}

For each affected ticker, return its confidence tier, the direction of the reaction, and a concise
reasoning string (spell out the causal chain for indirect links). Also return related_event_ids if
you can infer them; otherwise return an empty array.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  const parsed = JSON.parse(text);
  return { ...parsed, model: MODEL, generated_at: new Date().toISOString() };
}
