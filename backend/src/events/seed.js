// Curated, real-sourced seed events for the bubble map.
//
// Schema note: this is a superset of the build-spec §2a event schema. The confidence
// TIER lives on each per-ticker `impact` (an event can hit different stocks with different
// tiers — e.g. the Mar 27 selloff is `indirect` for MSFT/NVDA/AMZN but `unrelated` for AAPL).
// `affected_tickers` and a dominant `confidence_tier` are still derived for §2a compatibility.
//
// tier: 'direct' | 'indirect' | 'unrelated'
// direction: 'up' | 'down' | 'none'  (expected/observed direction of the stock reaction)

export const STOCKS = {
  AAPL: { name: 'Apple', sector: 'Consumer tech / hardware', allocation: 10000 },
  TSLA: { name: 'Tesla', sector: 'EV / auto / energy', allocation: 8000 },
  NVDA: { name: 'Nvidia', sector: 'Semiconductors / AI', allocation: 7000 },
  AMZN: { name: 'Amazon', sector: 'E-commerce / cloud', allocation: 7000 },
  MSFT: { name: 'Microsoft', sector: 'Cloud / enterprise software', allocation: 6000 },
  XOM: { name: 'ExxonMobil', sector: 'Energy / oil & gas', allocation: 7000 },
  DAL: { name: 'Delta Air Lines', sector: 'Airlines / travel', allocation: 5000 },
};

const L = {
  tehran: { lat: 35.6892, lon: 51.389, name: 'Tehran, Iran' },
  hormuz: { lat: 26.5667, lon: 56.25, name: 'Strait of Hormuz' },
  nyse: { lat: 40.7069, lon: -74.0113, name: 'New York (NYSE)' },
  dc: { lat: 38.8977, lon: -77.0365, name: 'Washington, D.C.' },
  geneva: { lat: 46.2044, lon: 6.1432, name: 'Geneva (talks)' },
  austin: { lat: 30.2226, lon: -97.618, name: 'Austin, TX (Tesla HQ)' },
  oman: { lat: 24.34, lon: 58.6, name: 'Gulf of Oman' },
  santaclara: { lat: 37.3707, lon: -121.9642, name: 'Santa Clara, CA (Nvidia HQ)' },
};

export const EVENTS = [
  {
    id: 'evt_001',
    date: '2026-02-28T02:23:00-05:00',
    headline: "Iran's supreme leader dead following major attack by U.S., Israel",
    category: 'geopolitical_conflict',
    location: L.tehran,
    source: {
      outlet: 'AP',
      url: 'https://spectrumlocalnews.com/us/snplus/international/2026/02/28/israel-launches-attack-on-iran-s-capital-with-u-s--help-as-tensions-high-over-nuclear-talks',
      published_at: '2026-02-28T02:23:00-05:00',
      updated_at: '2026-02-28T21:07:00-05:00',
    },
    related_event_ids: ['evt_002'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Strikes on a major oil-producing nation raise the risk of supply disruption near the Gulf. Crude prices climb, which flows straight into ExxonMobil upstream revenue and refining margins — a mechanical, business-level link.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'down',
        reasoning:
          "Higher crude feeds directly into jet-fuel prices, Delta's single largest variable cost. Fuel-cost exposure is a direct P&L hit, so the stock sells off on the supply-shock headline.",
      },
    ],
  },
  {
    id: 'evt_002',
    date: '2026-03-02T09:30:00-05:00',
    headline: 'Oil prices rise sharply after U.S.–Israeli attacks on Iran; Strait of Hormuz in focus',
    category: 'geopolitical_conflict',
    location: L.hormuz,
    source: {
      outlet: 'Al Jazeera',
      url: 'https://www.aljazeera.com/news/2026/3/2/oil-prices-rise-sharply-after-us-israeli-attacks-on-iran',
      published_at: '2026-03-02T06:00:00-05:00',
      updated_at: '2026-03-02T12:00:00-05:00',
    },
    related_event_ids: ['evt_001', 'evt_009'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          '~20% of seaborne oil transits the Strait of Hormuz. Disruption fear spikes crude; XOM traded up ~4% pre-market as an integrated-oil beneficiary of higher prices.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Same Hormuz shock, opposite sign: a crude spike raises Delta’s projected jet-fuel bill, so shares fell 5%+ pre-market on margin-compression fears.',
      },
    ],
  },
  {
    id: 'evt_003',
    date: '2026-03-27T09:30:00-04:00',
    headline: 'Broad tech selloff as Iran-driven oil spike revives inflation and rate fears',
    category: 'macro_policy',
    location: L.nyse,
    source: {
      outlet: 'Market wrap',
      url: '',
      published_at: '2026-03-27T09:30:00-04:00',
      updated_at: '2026-03-27T16:00:00-04:00',
    },
    related_event_ids: ['evt_002'],
    impacts: [
      {
        ticker: 'MSFT',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Causal chain: oil spike → higher headline inflation expectations → market fears the Fed holds rates “higher for longer” → a higher discount rate compresses the valuation of long-duration megacap tech. MSFT was the week’s largest tech mover (-7%). No direct business link to oil — the transmission is purely macro/sentiment, hence indirect.',
      },
      {
        ticker: 'NVDA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Same rate-fear mechanism as MSFT: high-multiple AI hardware name de-rates when discount rates are expected to rise. -3% on the day with no oil-specific business exposure.',
      },
      {
        ticker: 'AMZN',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Rate-driven multiple compression on a long-duration growth name (-3%). Secondary nuance: higher fuel could raise fulfillment costs, but the day’s move was macro-sentiment, not that direct link.',
      },
      {
        ticker: 'TSLA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Caught in the broad rate-fear selloff (-2%) rather than any oil-specific driver — indirect, sentiment-led.',
      },
      {
        ticker: 'AAPL',
        tier: 'unrelated',
        direction: 'none',
        reasoning:
          'The control case: Apple actually posted a slight GAIN the same week while its megacap peers fell. The selloff’s rate-driven mechanism didn’t transmit to AAPL that day, so linking it to the oil headline would be false pattern-matching — flagged unrelated.',
      },
    ],
  },
  {
    id: 'evt_004',
    date: '2026-04-01T10:00:00-04:00',
    headline: 'Peace-talk reports trigger de-escalation; oil reverses, XOM -5% intraday',
    category: 'geopolitical_conflict',
    location: L.geneva,
    source: { outlet: 'Wire reports', url: '', published_at: '2026-04-01T10:00:00-04:00' },
    related_event_ids: ['evt_002', 'evt_005'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'De-escalation headlines unwind the supply-risk premium in crude. Falling oil directly reverses the earlier XOM trade — down ~5% intraday.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Lower crude lowers projected jet-fuel costs, directly improving Delta’s margin outlook — the mirror image of the spike trade.',
      },
    ],
  },
  {
    id: 'evt_005',
    date: '2026-04-08T14:00:00-04:00',
    headline: "Trump announces two-week pause; oil drops, Delta surges",
    category: 'macro_policy',
    location: L.dc,
    source: { outlet: 'Wire reports', url: '', published_at: '2026-04-08T14:00:00-04:00' },
    related_event_ids: ['evt_004'],
    impacts: [
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'A pause lowers near-term supply risk; the resulting oil-price drop directly cuts Delta’s largest cost input, and shares surged on the improved fuel-cost outlook.',
      },
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning: 'Falling crude on de-escalation directly pressures integrated-oil revenue and the stock.',
      },
    ],
  },
  {
    id: 'evt_006',
    date: '2026-04-23T16:05:00-04:00',
    headline: 'Tesla falls 3.4% despite earnings beat — capex guidance, not oil, is the driver',
    category: 'earnings',
    location: L.austin,
    source: { outlet: 'Company report', url: '', published_at: '2026-04-23T16:05:00-04:00' },
    related_event_ids: ['evt_003'],
    impacts: [
      {
        ticker: 'TSLA',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'The best “same day, two causes” teaching case. Tesla BEAT EPS estimates, yet fell 3.4%. The real, company-specific driver was raised capex guidance for robots/factories, which pressures free-cash-flow expectations. Oil-driven market pressure also hit the tape that day, but attributing TSLA’s drop to oil would be wrong — the direct cause is the capex guidance in its own earnings release.',
      },
    ],
  },
  {
    id: 'evt_007',
    date: '2026-06-15T08:00:00-04:00',
    headline: 'Framework to end the war confirmed; Brent -4.5%, XOM gives back gains',
    category: 'geopolitical_conflict',
    location: L.geneva,
    source: { outlet: 'Wire reports', url: '', published_at: '2026-06-15T08:00:00-04:00' },
    related_event_ids: ['evt_002'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'A confirmed peace framework removes the war-risk premium from oil. Brent fell 4.5% and XOM gave back its conflict-driven gains — a direct price-to-revenue link.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'up',
        reasoning: 'Lower crude directly reduces Delta’s fuel-cost outlook, supporting the shares.',
      },
    ],
  },
  {
    id: 'evt_008',
    date: '2026-06-26T09:00:00-04:00',
    headline: 'Attack near Oman — yet Brent falls (the counterintuitive case)',
    category: 'geopolitical_conflict',
    location: L.oman,
    source: { outlet: 'Wire reports', url: '', published_at: '2026-06-26T09:00:00-04:00' },
    related_event_ids: ['evt_002'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'The reasoning-stress-test: a fresh attack headline “should” push oil up, but Brent FELL. The market weighted ample spare capacity and soft demand over the incident, so the naive “conflict → oil up → XOM up” link did NOT hold. Flagged indirect / low-confidence precisely because the mechanical link broke down.',
      },
      {
        ticker: 'DAL',
        tier: 'indirect',
        direction: 'up',
        reasoning:
          'With crude falling despite the attack, Delta’s fuel outlook improved — but the low-confidence, counterintuitive setup makes this indirect rather than a clean direct read.',
      },
    ],
  },
  {
    id: 'evt_009',
    date: '2026-07-07T09:30:00-04:00',
    headline: 'Tanker attack + U.S. revokes Iran oil-sale license; Brent +3%, +5.6% after-hours',
    category: 'geopolitical_conflict',
    location: L.hormuz,
    source: { outlet: 'Wire reports', url: '', published_at: '2026-07-07T09:30:00-04:00' },
    related_event_ids: ['evt_002'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'A tanker attack plus a revoked oil-sale license tightens supply expectations. Brent rose 3% (5.6% after-hours), directly lifting XOM as a higher-price beneficiary. Same causal shape as the Mar 2 Hormuz event — hence the event-to-event link.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'down',
        reasoning: 'Renewed crude spike raised jet-fuel cost fears; Delta fell 2.93% to $86.02 — a direct fuel-cost reaction.',
      },
    ],
  },
  {
    id: 'evt_010',
    date: '2026-07-07T11:00:00-04:00',
    headline: 'Nvidia dips on report DeepSeek is developing custom chips',
    category: 'competitor_news',
    location: L.santaclara,
    source: { outlet: 'Tech press', url: '', published_at: '2026-07-07T11:00:00-04:00' },
    related_event_ids: ['evt_009'],
    impacts: [
      {
        ticker: 'NVDA',
        tier: 'unrelated',
        direction: 'down',
        reasoning:
          'The key control case. Nvidia fell 1.5–2.2% on the SAME day as the tanker-attack oil headline, so a naive “blame the biggest headline” model would tie it to Iran. The real driver was a competitive-threat report that DeepSeek is building custom chips — unrelated to the geopolitical oil move. Correctly attributing this proves the system reasons about causation instead of matching same-day headlines.',
      },
    ],
  },
];
