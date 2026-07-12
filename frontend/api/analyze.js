// Vercel serverless function: POST /api/analyze
//
// Runs the Analysis tab's Gemini call server-side so the API key never reaches the
// browser. Set GEMINI_API_KEY (no VITE_ prefix — that prefix tells Vite to inline a
// value into the public JS bundle, which is exactly what must NOT happen to this key)
// in the Vercel project's environment variables. Model override: GEMINI_MODEL.
//
// Note for local dev: `vite dev` alone does not run this function — use `vercel dev`
// from the frontend/ directory to test the Analysis tab locally.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';
const MAX_STUDIES = 5;

const SYSTEM = `You are Otto, an evidence-first equity event analyst. Produce educational, \
non-personalized research from ONLY the supplied data. Never invent prices or events; when a \
data point is missing, say so explicitly rather than guessing. Be skeptical and precise about \
what the historical evidence does and does not support. Intraday data is not supplied — daily \
high/low range is only a volatility proxy. The buy/sell/hold signal is an educational research \
signal, not personalized investment advice.`;

// One report object per input study (per ticker). Every field is required, so a 200
// response is structurally guaranteed complete — no more "does this substring appear
// somewhere in the blob" heuristics, and no hand-rolled markdown-table parsing on the
// client.
const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reports: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ticker: { type: 'STRING' },
          executiveSummary: { type: 'STRING', description: '3-4 plain-language sentences distinguishing historical evidence from inference.' },
          historicalPattern: {
            type: 'OBJECT',
            properties: {
              rows: {
                type: 'ARRAY',
                description: 'One row per comparable historical event, oldest to newest.',
                items: {
                  type: 'OBJECT',
                  properties: {
                    eventDate: { type: 'STRING' },
                    headline: { type: 'STRING' },
                    baseline: { type: 'STRING', description: 'T-30d/T-7d/T-1d price context, or "not available".' },
                    reaction: { type: 'STRING', description: 'T0/T+1d reaction, or "not available".' },
                    later: { type: 'STRING', description: 'T+7d/T+30d/T+90d follow-through, or "not available".' },
                    movePct: { type: 'STRING' },
                    recovery: { type: 'STRING', description: 'Time to recover to baseline, or "not available".' },
                  },
                  required: ['eventDate', 'headline', 'baseline', 'reaction', 'later', 'movePct', 'recovery'],
                  propertyOrdering: ['eventDate', 'headline', 'baseline', 'reaction', 'later', 'movePct', 'recovery'],
                },
              },
              averageDrawdownPct: { type: 'STRING' },
              averageRecoveryTime: { type: 'STRING' },
              variance: { type: 'STRING' },
              reliabilityNote: { type: 'STRING', description: 'Explicitly flag if fewer than 3 comparables make the pattern unreliable.' },
            },
            required: ['rows', 'averageDrawdownPct', 'averageRecoveryTime', 'variance', 'reliabilityNote'],
            propertyOrdering: ['rows', 'averageDrawdownPct', 'averageRecoveryTime', 'variance', 'reliabilityNote'],
          },
          currentEventAssessment: { type: 'STRING', description: 'How this event compares to the historical set, using only supplied data.' },
          scores: {
            type: 'OBJECT',
            properties: {
              riskScore: { type: 'NUMBER', description: '0-100' },
              riskRationale: { type: 'STRING' },
              recoveryScore: { type: 'NUMBER', description: '0-100' },
              recoveryRationale: { type: 'STRING' },
              signal: { type: 'STRING', enum: ['Buy', 'Sell', 'Hold'] },
              confidence: { type: 'STRING', enum: ['Low', 'Medium', 'High'] },
              signalRationale: { type: 'STRING' },
            },
            required: ['riskScore', 'riskRationale', 'recoveryScore', 'recoveryRationale', 'signal', 'confidence', 'signalRationale'],
            propertyOrdering: ['riskScore', 'riskRationale', 'recoveryScore', 'recoveryRationale', 'signal', 'confidence', 'signalRationale'],
          },
          timeHorizon: {
            type: 'OBJECT',
            properties: {
              shortTerm: { type: 'STRING', description: '1-7 days' },
              mediumTerm: { type: 'STRING', description: '1-3 months' },
              longTerm: { type: 'STRING', description: '3-12 months; say if evidence is unavailable at this horizon.' },
            },
            required: ['shortTerm', 'mediumTerm', 'longTerm'],
            propertyOrdering: ['shortTerm', 'mediumTerm', 'longTerm'],
          },
          keyRisks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'What could invalidate this analysis, including missing data.' },
        },
        required: ['ticker', 'executiveSummary', 'historicalPattern', 'currentEventAssessment', 'scores', 'timeHorizon', 'keyRisks'],
        propertyOrdering: ['ticker', 'executiveSummary', 'historicalPattern', 'currentEventAssessment', 'scores', 'timeHorizon', 'keyRisks'],
      },
    },
  },
  required: ['reports'],
};

async function callGemini(model, payload, maxOutputTokens, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: `Analysis data:\n${JSON.stringify(payload)}` }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: REPORT_SCHEMA,
    },
  });

  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!response.ok) {
    const errorBody = await response.text();
    const err = new Error(`${model} (${response.status}): ${errorBody.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  if (!text) throw new Error(`${model} returned no content (finishReason: ${finishReason || 'unknown'}).`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${model} returned malformed JSON.`);
  }
  if (!Array.isArray(parsed?.reports) || !parsed.reports.length) {
    throw new Error(`${model} returned no reports.`);
  }
  return parsed.reports;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Gemini is not configured on the server. Set GEMINI_API_KEY in the Vercel project environment variables.' });
    return;
  }

  const { studies } = req.body || {};
  if (!Array.isArray(studies) || !studies.length) {
    res.status(400).json({ error: 'Request must include a non-empty "studies" array.' });
    return;
  }
  if (studies.length > MAX_STUDIES) {
    res.status(400).json({ error: `Select at most ${MAX_STUDIES} holdings per report.` });
    return;
  }

  // A full structured report per ticker needs real headroom — Gemini's 2.5/3-generation
  // flash models "think" by default and those tokens count against maxOutputTokens, so a
  // budget sized for a single short answer silently truncates a multi-ticker report before
  // any visible JSON comes out. Scale with ticker count instead of using a fixed budget.
  const maxOutputTokens = Math.min(8192, 1500 + studies.length * 1700);
  const payload = { generatedAt: new Date().toISOString(), studies };

  const models = [...new Set([MODEL, FALLBACK_MODEL])];
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const reports = await callGemini(model, payload, maxOutputTokens, apiKey);
        res.status(200).json({ reports, model });
        return;
      } catch (error) {
        lastError = error;
        const retryable = error.status === 429 || error.status === 503;
        if (!retryable) break;
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }

  console.error('[api/analyze]', lastError);
  res.status(502).json({ error: `Gemini is temporarily unavailable. ${lastError?.message || ''}`.trim() });
}
