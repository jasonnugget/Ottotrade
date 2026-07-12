// Curated, real-sourced seed events for the bubble map.
//
// EVERY event here links to a real, published article or primary filing (company IR
// release, SEC 8-K, or a named outlet). That URL is the evidence the event happened —
// the EventPanel renders it, and an event without one has no business being in the map.
//
// Schema note: this is a superset of the build-spec §2a event schema. The confidence
// TIER lives on each per-ticker `impact` (an event can hit different stocks with different
// tiers — e.g. the Mar 27 selloff is `indirect` for MSFT/NVDA/AMZN but `unrelated` for AAPL).
// `affected_tickers` and a dominant `confidence_tier` are still derived for §2a compatibility.
//
// tier: 'direct' | 'indirect' | 'unrelated'
// direction: 'up' | 'down' | 'none'  (observed direction of the stock reaction)
//
// DATE CONVENTION: `date` is the trading session the market REACTED in, because that is
// the bar the seed generator measures the price move against (see priceReaction in
// scripts/generate-supabase-seed.mjs). Earnings released after the close therefore carry
// the NEXT session's date, while `source.published_at` holds the true publication time.

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
  santaclara: { lat: 37.3707, lon: -121.9642, name: 'Santa Clara, CA (Nvidia HQ)' },
  cupertino: { lat: 37.3349, lon: -122.0090, name: 'Cupertino, CA (Apple Park)' },
  redmond: { lat: 47.6396, lon: -122.1284, name: 'Redmond, WA (Microsoft HQ)' },
  seattle: { lat: 47.6205, lon: -122.3493, name: 'Seattle, WA (Amazon HQ)' },
  mountainview: { lat: 37.422, lon: -122.0841, name: 'Mountain View, CA (Alphabet HQ)' },
  menlopark: { lat: 37.4848, lon: -122.1484, name: 'Menlo Park, CA (Meta HQ)' },
  paloalto: { lat: 37.4419, lon: -122.143, name: 'Palo Alto, CA (Broadcom HQ)' },
  manhattan: { lat: 40.7557, lon: -73.9787, name: 'New York, NY (JPMorgan HQ)' },
  bentonville: { lat: 36.3729, lon: -94.2088, name: 'Bentonville, AR (Walmart HQ)' },
  indianapolis: { lat: 39.7684, lon: -86.1581, name: 'Indianapolis, IN (Eli Lilly HQ)' },
  fostercity: { lat: 37.5585, lon: -122.2711, name: 'Foster City, CA (Visa HQ)' },
  losgatos: { lat: 37.2358, lon: -121.9624, name: 'Los Gatos, CA (Netflix HQ)' },
  shenzhen: { lat: 22.5431, lon: 114.0579, name: 'China (DeepSeek)' },
  silverspring: { lat: 38.9907, lon: -77.0261, name: 'Silver Spring, MD (FDA)' },
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
    related_event_ids: ['evt_001', 'evt_027'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          '~20% of seaborne oil transits the Strait of Hormuz. Disruption fear spikes crude; XOM traded up as an integrated-oil beneficiary of higher prices.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Same Hormuz shock, opposite sign: a crude spike raises Delta’s projected jet-fuel bill, so shares fell on margin-compression fears.',
      },
    ],
  },
  {
    id: 'evt_003',
    date: '2026-03-27T09:30:00-04:00',
    headline: 'Nasdaq falls into correction as Brent tops $110 and inflation fears build',
    category: 'macro_policy',
    location: L.nyse,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/03/26/stock-market-today-live-updates.html',
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
          'Causal chain: oil spike → higher headline inflation expectations → market fears the Fed holds rates "higher for longer" → a higher discount rate compresses the valuation of long-duration megacap tech. No direct business link to oil — the transmission is purely macro/sentiment, hence indirect.',
      },
      {
        ticker: 'NVDA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Same rate-fear mechanism as MSFT: a high-multiple AI hardware name de-rates when discount rates are expected to rise, with no oil-specific business exposure.',
      },
      {
        ticker: 'AMZN',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Rate-driven multiple compression on a long-duration growth name. Secondary nuance: higher fuel could raise fulfillment costs, but the day’s move was macro-sentiment, not that direct link.',
      },
      {
        ticker: 'TSLA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Caught in the broad rate-fear selloff rather than any oil-specific driver — indirect, sentiment-led.',
      },
      {
        ticker: 'GOOGL',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Long-duration megacap caught in the same discount-rate de-rating. CNBC also tied the session’s tech losses to regulatory pressure on Meta and Google, which compounds the macro move but is a separate driver.',
      },
      {
        ticker: 'META',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Same rate-fear de-rating as its megacap peers, with the session’s coverage additionally citing regulatory scrutiny weighing on Meta. Indirect: no oil-linked business exposure.',
      },
      {
        ticker: 'NFLX',
        tier: 'unrelated',
        direction: 'none',
        reasoning:
          'A control case. Netflix closed essentially FLAT (+0.1%) while the Nasdaq fell 2.15% — the rate-driven de-rating that hit its megacap peers simply did not transmit here. Sweeping it into the selloff because it is "a tech stock" would be exactly the false pattern-matching this map exists to catch.',
      },
      {
        ticker: 'V',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Payments volume is pro-cyclical: an oil-driven inflation scare raises recession risk, which the market prices as slower consumer transaction growth. Indirect — a demand-expectation channel, not a cost line.',
      },
      {
        ticker: 'AAPL',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Apple fell with the tape (-1.6%) but by LESS than the Nasdaq’s -2.15% — it participated in the discount-rate de-rating without being the epicentre. Indirect: no oil-linked business exposure, and the underperformance-adjusted move is a market-beta effect rather than an Apple-specific one.',
      },
      {
        ticker: 'JPM',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'The instructive one. The tidy thesis is "higher-for-longer rates help asset-sensitive banks," which would argue JPM should hold up — and it did NOT: it fell 3%, worse than the index. On a day when an oil shock raises recession odds, credit-loss fear outweighs the net-interest-margin benefit. Indirect, and a reminder that the textbook rate story loses to risk-off when growth is the worry.',
      },
      {
        ticker: 'WMT',
        tier: 'unrelated',
        direction: 'up',
        reasoning:
          'The clean control case: Walmart ROSE (+0.6%) while the Nasdaq fell into correction. Defensive staples absorb the rotation out of long-duration growth in a recession-risk session, so the tech selloff is not a valid explanation for Walmart’s move — the causation runs the other way, if at all.',
      },
      {
        ticker: 'LLY',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Lilly fell about 2% with the broad market. Pharma cash flows are not driven by the oil/rate chain, so this is index-beta participation rather than a causal link — indirect, and it should not be read as the market repricing the drug franchise.',
      },
    ],
  },
  {
    id: 'evt_004',
    date: '2026-04-01T10:00:00-04:00',
    headline: 'FDA approves Lilly’s Foundayo (orforglipron), the first any-time-of-day GLP-1 weight-loss pill',
    category: 'regulatory',
    location: L.silverspring,
    source: {
      outlet: 'Eli Lilly (company release)',
      url: 'https://investor.lilly.com/news-releases/news-release-details/fda-approves-lillys-foundayotm-orforglipron-only-glp-1-pill',
      published_at: '2026-04-01T10:00:00-04:00',
    },
    related_event_ids: ['evt_016'],
    impacts: [
      {
        ticker: 'LLY',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'A regulatory approval is the most mechanical catalyst there is: Foundayo is an ORAL GLP-1, which removes the injection barrier and the cold-chain constraint that cap the addressable market for injectables. Approval converts a pipeline asset into a revenue line — a direct, company-specific value event.',
      },
    ],
  },
  {
    id: 'evt_005',
    date: '2026-04-08T14:00:00-04:00',
    headline: 'Oil prices slide, stocks surge as Trump announces two-week Iran ceasefire',
    category: 'geopolitical_conflict',
    location: L.dc,
    source: {
      outlet: 'Al Jazeera',
      url: 'https://www.aljazeera.com/news/2026/4/8/oil-prices-slide-stocks-surge-as-trump-announces-two-week-iran-ceasefire',
      published_at: '2026-04-08T14:00:00-04:00',
    },
    related_event_ids: ['evt_002', 'evt_019'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'A ceasefire plus the prospect of safe Hormuz transit unwinds the war-risk premium. U.S. crude fell from ~$117 to ~$95, and falling crude directly compresses integrated-oil revenue — the mirror image of the February spike trade.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Same crude move, opposite sign: a sharp drop in oil directly cuts Delta’s projected jet-fuel bill, its largest variable cost, so the shares rallied on the improved margin outlook.',
      },
    ],
  },
  {
    id: 'evt_006',
    date: '2026-04-14T09:30:00-04:00',
    headline: 'JPMorgan posts $16.5B first-quarter profit; revenue up 10% on record Markets results',
    category: 'earnings',
    location: L.manhattan,
    source: {
      outlet: 'JPMorgan Chase (1Q26 earnings release)',
      url: 'https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/1st-quarter/a5fd2d13-877b-43b2-8b58-81bad4399c87.pdf',
      published_at: '2026-04-14T06:50:00-04:00',
    },
    related_event_ids: ['evt_022'],
    impacts: [
      {
        ticker: 'JPM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Net income of $16.5B (EPS $5.94) on revenue of $50.5B, up 10%, with a 23% return on tangible common equity and net interest income up 9% — and the stock still eased ~0.8% on the day. A beat that was already the consensus expectation is not a catalyst; the market had priced the strong quarter going in. Direct because this is JPMorgan’s own P&L, but note the sign: strong results and a positive stock reaction are NOT the same thing.',
      },
    ],
  },
  {
    id: 'evt_007',
    date: '2026-04-17T09:30:00-04:00',
    headline: 'Netflix revenue climbs 16% — and the stock drops nearly 10%',
    category: 'earnings',
    location: L.losgatos,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/16/netflix-nflx-earnings-q1-2026.html',
      published_at: '2026-04-16T16:05:00-04:00',
    },
    related_event_ids: ['evt_022'],
    impacts: [
      {
        ticker: 'NFLX',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Q1 revenue rose 16% to $12.25B on the March price increases (Standard to $19.99, Premium to $26.99) and an ad tier reaching 250M+ monthly active viewers — and the stock fell almost 10%. Growth of 16% is a deceleration for a company valued on continued acceleration, and Netflix has stopped reporting quarterly subscriber counts, which removes the metric bulls used to underwrite the multiple. Direct: this is Netflix’s own report, and it is the sharpest single-name reaction in this dataset — a beat on the top line is not a beat on expectations.',
      },
    ],
  },
  {
    id: 'evt_008',
    date: '2026-04-20T09:30:00-04:00',
    headline: 'Tim Cook to become executive chairman; John Ternus named Apple CEO effective September 1',
    category: 'company_specific',
    location: L.cupertino,
    source: {
      outlet: 'Apple Newsroom',
      url: 'https://www.apple.com/newsroom/2026/04/tim-cook-to-become-apple-executive-chairman-john-ternus-to-become-apple-ceo/',
      published_at: '2026-04-20T09:00:00-04:00',
    },
    related_event_ids: ['evt_015'],
    impacts: [
      {
        ticker: 'AAPL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'A CEO succession at the world’s most valuable company is a direct, company-specific governance event — and the market read it as continuity, not disruption: the stock ROSE ~1% on the announcement. Cook moves to executive chairman rather than leaving, hardware chief John Ternus was the long-groomed internal pick, and the board approved it unanimously. Succession risk that resolves cleanly removes an overhang instead of creating one.',
      },
    ],
  },
  {
    id: 'evt_009',
    date: '2026-04-23T09:30:00-04:00',
    headline: 'Tesla beats on Q1 earnings but stock falls as capex guidance jumps past $25B',
    category: 'earnings',
    location: L.austin,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/22/tesla-tsla-q1-2026-earnings-report.html',
      published_at: '2026-04-22T16:05:00-04:00',
    },
    related_event_ids: ['evt_003', 'evt_026'],
    impacts: [
      {
        ticker: 'TSLA',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'The best "same day, two causes" teaching case. Tesla BEAT on EPS ($0.41, +17% vs. estimates) with the strongest gross margin in five quarters, and initially popped 4% after hours. Then the CFO confirmed full-year capex above $25B — up from $20B and roughly triple 2025’s $8.6B — and the stock gave it all back, closing down 3.56%. The direct cause is the capex guidance in its own release, NOT the macro tape.',
      },
    ],
  },
  {
    id: 'evt_010',
    date: '2026-04-29T09:30:00-04:00',
    headline: 'Visa fiscal Q2 revenue up 17% to $11.2B; board authorizes new $20B buyback',
    category: 'earnings',
    location: L.fostercity,
    source: {
      outlet: 'Visa (company release)',
      url: 'https://investor.visa.com/news/news-details/2026/Visa-Fiscal-Second-Quarter-2026-Financial-Results/default.aspx',
      published_at: '2026-04-28T17:05:00-04:00',
    },
    related_event_ids: ['evt_022'],
    impacts: [
      {
        ticker: 'V',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Net revenue of $11.2B, up 17% — the fastest growth since 2022 — with non-GAAP EPS of $3.31 beating consensus, plus $9.2B returned to shareholders and a fresh $20B repurchase authorization. Direct: Visa earns a toll on payment volume, so accelerating volume is a mechanical revenue link, not a sentiment read.',
      },
    ],
  },
  {
    id: 'evt_011',
    date: '2026-04-30T09:30:00-04:00',
    headline: 'Meta revenue jumps 33% but shares slide as 2026 AI capex guidance is raised to $145B',
    category: 'earnings',
    location: L.menlopark,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/29/meta-q1-earnings-report-2026.html',
      published_at: '2026-04-29T16:05:00-04:00',
    },
    related_event_ids: ['evt_012', 'evt_013', 'evt_014', 'evt_024'],
    impacts: [
      {
        ticker: 'META',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Revenue grew 33% — the fastest since 2021 — and the stock still fell, because Meta raised 2026 capex guidance to $125–145B, nearly double 2025 and more than 2025 and 2024 combined. The market is pricing the free-cash-flow hit, not the revenue beat. Direct: this is Meta’s own guidance in its own release.',
      },
      {
        ticker: 'NVDA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'The textbook logic says one company’s capex is another’s revenue — a customer spending $145B on AI should be GOOD for the accelerator vendor. It did not play out: Nvidia fell 4.6% the same session. When the market decides AI capex is value-destroying, it sells the spenders AND the suppliers, because the fear is that the spending itself gets cut. Indirect, and a live example of the obvious read-through failing.',
      },
      {
        ticker: 'AVGO',
        tier: 'indirect',
        direction: 'up',
        reasoning:
          'Broadcom counts Meta among its custom-AI-silicon customers, and it ROSE on the day even as Nvidia fell — a divergence worth noticing. Custom-ASIC exposure is read as a share-gain story (hyperscalers designing their own chips buy Broadcom, not Nvidia), so the same capex headline can cut opposite ways across two "AI chip" names. Indirect: a customer-spending read-through, not Broadcom’s own results.',
      },
    ],
  },
  {
    id: 'evt_012',
    date: '2026-04-30T09:30:00-04:00',
    headline: 'Alphabet Q1 revenue hits $109.9B, up 22%, as Google Cloud grows 63%',
    category: 'earnings',
    location: L.mountainview,
    source: {
      outlet: 'Alphabet (Q1 2026 earnings slides)',
      url: 'https://s206.q4cdn.com/479360582/files/doc_financials/2026/q1/Alphabet-Q1-2026-Earnings-Slides.pdf',
      published_at: '2026-04-29T16:05:00-04:00',
    },
    related_event_ids: ['evt_011', 'evt_013', 'evt_014', 'evt_020'],
    impacts: [
      {
        ticker: 'GOOGL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Revenue of $109.9B (+22%) beat the $107.2B consensus, EPS rose 82% to $5.11, and Google Cloud grew 63% to $20.03B with operating income tripling to $6.6B. Cloud backlog nearly doubled to $460B+. Direct: Alphabet’s own reported results — and the Cloud number is the one that answers the "will AI eat Search?" bear case.',
      },
    ],
  },
  {
    id: 'evt_013',
    date: '2026-04-30T09:30:00-04:00',
    headline: 'Microsoft Q3 revenue rises 13% on Azure AI demand — but shares fall on the capex bill',
    category: 'earnings',
    location: L.redmond,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/29/microsoft-msft-q3-earnings-report-2026.html',
      published_at: '2026-04-29T16:05:00-04:00',
    },
    related_event_ids: ['evt_011', 'evt_012', 'evt_014', 'evt_020'],
    impacts: [
      {
        ticker: 'MSFT',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Fiscal Q3 revenue of $61.9B (+13%), Azure up 31% on AI demand, and Azure guidance of 39–40% constant-currency growth against a 37% consensus — a beat on the metric that matters most, and the stock fell nearly 4%. The offset is the capex line: ~$190B guided for 2026, up 61%, with a $25B hit from higher component prices. Direct: Microsoft’s own results and guidance. Same shape as Meta and Amazon on the same day — the market is repricing AI spending, not AI revenue.',
      },
    ],
  },
  {
    id: 'evt_014',
    date: '2026-04-30T09:30:00-04:00',
    headline: 'Amazon crushes earnings as AWS grows 28%, its fastest in three years',
    category: 'earnings',
    location: L.seattle,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/29/amazon-amzn-q1-earnings-report-2026.html',
      published_at: '2026-04-29T16:05:00-04:00',
    },
    related_event_ids: ['evt_011', 'evt_012', 'evt_013', 'evt_024'],
    impacts: [
      {
        ticker: 'AMZN',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'EPS of $2.78 against a $1.64 estimate, with AWS up 28% to $37.59B — its fastest growth in over three years. Amazon closed higher, and that is the contrast worth studying: Microsoft and Meta reported the SAME day with the same enormous capex ($190B and $145B) and both fell, while Amazon’s ~$200B plan was forgiven because the cloud acceleration gave the market something to buy. The capex fear is real (trailing free cash flow is down 95% to $1.2B) — it just needed a growth number to outweigh it.',
      },
    ],
  },
  {
    id: 'evt_015',
    date: '2026-05-01T09:30:00-04:00',
    headline: 'Apple posts best March quarter ever: revenue $111.2B, up 17%; adds $100B to buyback',
    category: 'earnings',
    location: L.cupertino,
    source: {
      outlet: 'Apple Newsroom',
      url: 'https://www.apple.com/newsroom/2026/04/apple-reports-second-quarter-results/',
      published_at: '2026-04-30T16:30:00-04:00',
    },
    related_event_ids: ['evt_008'],
    impacts: [
      {
        ticker: 'AAPL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Record March quarter: revenue $111.2B (+17%), EPS $2.01 (+22%), gross margin 49.3% vs. 47.1% a year earlier, with double-digit growth in every geographic segment and an iPhone March-quarter record on iPhone 17 demand. The board added $100B to the repurchase authorization and raised the dividend. Direct: Apple’s own reported results.',
      },
    ],
  },
  {
    id: 'evt_016',
    date: '2026-04-30T09:30:00-04:00',
    headline: 'Eli Lilly Q1 revenue jumps 56% to $19.8B; full-year guidance raised to $82–85B',
    category: 'earnings',
    location: L.indianapolis,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/04/30/eli-lilly-lly-earnings-q1-2026.html',
      published_at: '2026-04-30T06:30:00-04:00',
    },
    related_event_ids: ['evt_004'],
    impacts: [
      {
        ticker: 'LLY',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Revenue rose 56% to $19.8B with non-GAAP EPS of $8.55 well ahead of expectations, driven by Mounjaro ($8.66B, +125%) and Zepbound ($4.16B). Management raised full-year guidance to $82–85B. Direct: the incretin franchise IS the company’s P&L right now, and the raise is management’s own guidance.',
      },
    ],
  },
  {
    id: 'evt_017',
    date: '2026-05-21T09:30:00-04:00',
    headline: 'Nvidia posts record $81.6B quarter, up 85%; adds $80B to buyback',
    category: 'earnings',
    location: L.santaclara,
    source: {
      outlet: 'NVIDIA (company release)',
      url: 'https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/default.aspx',
      published_at: '2026-05-20T16:20:00-04:00',
    },
    related_event_ids: ['evt_011', 'evt_024', 'evt_028'],
    impacts: [
      {
        ticker: 'NVDA',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'A record quarter that still sold off — the classic "buy the rumor, sell the news." Revenue of $81.6B (+85% YoY, +20% QoQ) with Data Center at $75.2B (+92%), 75% gross margins, an added $80B of buyback authorization and the dividend raised from $0.01 to $0.25. The beat was real but modest against a stock priced at ~30x forward earnings that had already run 13.7% into the print, so positioning — not the fundamentals — drove the reaction. Direct: Nvidia’s own results.',
      },
      {
        ticker: 'AVGO',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Broadcom reported nothing here, but Nvidia’s print is the sector’s sentiment barometer: when the AI bellwether sells off on positioning, high-beta AI-silicon peers de-rate with it. Indirect — a read-across, not a business link.',
      },
    ],
  },
  {
    id: 'evt_018',
    date: '2026-05-21T09:30:00-04:00',
    headline: 'Walmart revenue rises 7.3% but shares sink 7% as fuel costs bite into operating income',
    category: 'earnings',
    location: L.bentonville,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/05/21/walmart-wmt-earnings-q1-2027.html',
      published_at: '2026-05-21T07:00:00-04:00',
    },
    related_event_ids: ['evt_022', 'evt_002'],
    impacts: [
      {
        ticker: 'WMT',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'The headline looks fine — revenue $177.75B, net sales +7.1%, net income +18.8%, e-commerce +26% — and the stock fell 7.3%, its worst move in this dataset. Look at the operating line instead: operating income grew just 5%, and higher fuel costs across distribution and fulfilment cut 250 basis points off that growth. This is the Iran oil shock arriving on a retailer’s income statement — the same crude spike that lifts XOM is a direct cost for the company that has to move the goods. Sales growth you cannot convert into profit is not a good quarter.',
      },
    ],
  },
  {
    id: 'evt_019',
    date: '2026-05-29T09:30:00-04:00',
    headline: 'Oil drops 20% from its 2026 peak on optimism over U.S.–Iran ceasefire talks',
    category: 'geopolitical_conflict',
    location: L.geneva,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/05/29/oil-prices-iran-ceasefire-us-trump-strait-hormuz-energy-costs.html',
      published_at: '2026-05-29T09:30:00-04:00',
    },
    related_event_ids: ['evt_005', 'evt_021'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Crude 20% off its 2026 high as ceasefire optimism drains the war-risk premium. Lower realized prices feed straight through to upstream revenue — the direct, mechanical link, running in reverse from February.',
      },
      {
        ticker: 'DAL',
        tier: 'indirect',
        direction: 'none',
        reasoning:
          'The mechanism is real — a 20% retreat in crude cuts Delta’s largest variable cost — but Delta closed FLAT on the day, so the benefit did not show up in the tape. The ceasefire optimism had been building for weeks (see the April 8 pause), so the fuel-cost relief was already priced in by the time this headline landed. Marked indirect precisely because the expected reaction did not materialise: a valid mechanism is not the same as a same-day catalyst.',
      },
    ],
  },
  {
    id: 'evt_020',
    date: '2026-06-04T09:30:00-04:00',
    headline: 'Broadcom AI chip revenue doubles to $10.8B — and the stock still sinks on guidance',
    category: 'earnings',
    location: L.paloalto,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/06/03/broadcom-avgo-earnings-report-q2-2026.html',
      published_at: '2026-06-03T16:15:00-04:00',
    },
    related_event_ids: ['evt_011', 'evt_017', 'evt_024'],
    impacts: [
      {
        ticker: 'AVGO',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Record quarter — revenue $22.2B (+48%), AI semiconductor revenue $10.8B (+143%) — and the shares fell anyway because guidance did not clear an extremely high bar. This is the same lesson as Nvidia’s print two weeks earlier: when a stock is priced for perfection, "excellent" reads as a miss. Direct: Broadcom’s own results and guidance.',
      },
    ],
  },
  {
    id: 'evt_021',
    date: '2026-06-15T09:30:00-04:00',
    headline: 'Stock markets soar, oil falls as U.S. and Iran confirm framework to end the war',
    category: 'geopolitical_conflict',
    location: L.geneva,
    source: {
      outlet: 'Al Jazeera',
      url: 'https://www.aljazeera.com/economy/2026/6/15/stock-markets-soar-oil-falls-as-us-iran-confirm-deal-to-end-war',
      published_at: '2026-06-15T08:00:00-04:00',
    },
    related_event_ids: ['evt_002', 'evt_019', 'evt_023'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'A confirmed framework — extending the ceasefire and reopening the Strait of Hormuz to shipping — removes the war-risk premium from crude. Brent fell below $80 for the first time since March. Falling crude directly compresses XOM’s upstream revenue.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Reopening Hormuz restores an estimated 14 million barrels/day to the market. Cheaper crude means a cheaper jet-fuel bill — a direct, mechanical improvement to Delta’s largest cost line.',
      },
    ],
  },
  {
    id: 'evt_022',
    date: '2026-06-17T14:00:00-04:00',
    headline: 'Fed holds rates but dot plot flips to a hike as Iran-war inflation persists',
    category: 'macro_policy',
    location: L.dc,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/06/17/fed-interest-rate-decision-june-2026.html',
      published_at: '2026-06-17T14:00:00-04:00',
    },
    related_event_ids: ['evt_003', 'evt_006'],
    impacts: [
      {
        ticker: 'JPM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'The FOMC held at 3.50–3.75% but erased its remaining 2026 cut and now projects rates ENDING the year higher, with 17 of 18 officials seeing inflation risk to the upside. For an asset-sensitive bank this is a direct earnings input: loans reprice upward faster than deposits, expanding net interest income. The mechanism that hurts long-duration equities is the one that pays JPMorgan.',
      },
      {
        ticker: 'MSFT',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'A higher-for-longer path raises the discount rate applied to distant cash flows, which compresses the multiple on long-duration megacap tech. Indirect: nothing about Microsoft’s business changed on the day — only the rate used to value it.',
      },
      {
        ticker: 'GOOGL',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Same discount-rate channel as its megacap peers. A hawkish dot-plot flip de-rates growth multiples regardless of the underlying business, which is why this is indirect rather than direct.',
      },
      {
        ticker: 'META',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Rate-driven multiple compression, and it stings more here because Meta is spending $125–145B on AI capex — a higher discount rate makes a heavy, back-loaded investment program look more expensive in present-value terms.',
      },
      {
        ticker: 'AMZN',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Long-duration growth name carrying a ~$200B capex plan; a higher-for-longer rate path lowers the present value of the payoff from that spend. Indirect — a valuation channel, not an operating one.',
      },
      {
        ticker: 'NFLX',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'High-multiple growth equity de-rates when the terminal discount rate rises. Netflix’s subscriber economics did not change on the day — only what the market will pay for them.',
      },
      {
        ticker: 'V',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'A hawkish turn tightens financial conditions, which the market reads as slower consumer spending ahead — and Visa is paid on transaction volume. The chain (rates → consumer demand → payment volume) is real but macro-mediated, hence indirect.',
      },
      {
        ticker: 'WMT',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'The defensive-rotation thesis says staples should absorb money fleeing growth when the Fed turns hawkish — and here it FAILED: Walmart fell 2.4% with the market. Compare this to March 27, when the same thesis worked and Walmart rose while the Nasdaq corrected. Same stock, same playbook, opposite outcome. A tightening cycle eventually threatens the consumer that staples sell to, and defensiveness is relative, not absolute.',
      },
      {
        ticker: 'LLY',
        tier: 'unrelated',
        direction: 'down',
        reasoning:
          'The control case for this event. Lilly drifted down under 1% — noise, and far less than the rate-sensitive names. Its value is driven by the incretin franchise ramp and FDA milestones, not by the discount-rate mechanism that repriced tech. Treating a same-day Fed headline as the cause of a sub-1% move would be exactly the pattern-matching error this map exists to prevent.',
      },
    ],
  },
  {
    id: 'evt_023',
    // Published Friday June 19, which was a market holiday (Juneteenth) — the first
    // session that could price it was Monday June 22, so that is the reaction bar.
    date: '2026-06-22T09:30:00-04:00',
    headline: 'Oil rises after U.S.–Iran peace talks in Geneva are abruptly postponed',
    category: 'geopolitical_conflict',
    location: L.geneva,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/06/19/oil-prices-wti-brent-crude-us-iran-deal-strait-hormuz-shipping-recovery.html',
      published_at: '2026-06-19T09:30:00-04:00',
    },
    related_event_ids: ['evt_021', 'evt_025'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'The de-escalation trade partially reverses: postponed talks re-inject supply risk into crude, and a higher price directly lifts integrated-oil revenue. The whole Feb–Jul arc is one oscillating risk premium, which is why these oil events all link to one another.',
      },
      {
        ticker: 'DAL',
        tier: 'unrelated',
        direction: 'up',
        reasoning:
          'The link broke. Crude rose on the postponed talks — which "should" raise Delta’s jet-fuel bill and push the stock down — and Delta ROSE 2.1% instead. When the mechanical chain and the tape disagree this plainly, the honest answer is that the oil headline did not drive Delta that session; something else did. Flagged unrelated rather than forcing the story to fit.',
      },
    ],
  },
  {
    id: 'evt_024',
    date: '2026-06-23T09:30:00-04:00',
    headline: 'Global tech sell-off intensifies, led by AI and chip stocks',
    category: 'demand_shift',
    location: L.nyse,
    source: {
      outlet: 'NBC News',
      url: 'https://www.nbcnews.com/business/business-news/tech-sell-off-markets-spacex-alphabet-nasdaq100-stocks-rcna351331',
      published_at: '2026-06-23T09:30:00-04:00',
    },
    related_event_ids: ['evt_022', 'evt_017', 'evt_020'],
    impacts: [
      {
        ticker: 'NVDA',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'A broad, AI-and-chip-led global selloff days after the Fed’s hawkish flip. Nvidia is the highest-beta expression of the AI trade, so it takes the largest hit in a sector de-rating. Indirect: no company-specific news — this is positioning unwinding across the theme.',
      },
      {
        ticker: 'AVGO',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Same AI-complex unwind. Broadcom trades as an AI-silicon proxy, so it falls with the theme rather than on anything in its own business.',
      },
      {
        ticker: 'GOOGL',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Named in the coverage as one of the megacaps leading the Nasdaq-100 lower. Indirect — a theme-wide de-rating, not an Alphabet-specific catalyst.',
      },
      {
        ticker: 'META',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Caught in the same big-tech unwind. The market is re-pricing the entire "spend enormous capex on AI now, earn later" trade, and Meta has the most aggressive capex ramp of the group.',
      },
      {
        ticker: 'MSFT',
        tier: 'unrelated',
        direction: 'up',
        reasoning:
          'Read the label, not the headline. This was an AI-and-CHIP-led selloff, and Microsoft actually ROSE 1.8% through it. "Global tech sell-off" is a headline, not a mechanism: the money coming out of semiconductors did not come out of enterprise software. Sweeping MSFT into this event because it is a tech stock would be precisely the false attribution this map is built to expose.',
      },
      {
        ticker: 'AMZN',
        tier: 'unrelated',
        direction: 'up',
        reasoning:
          'Amazon also closed HIGHER (+0.6%) during the "global tech sell-off." The unwind was concentrated in AI hardware and chip names; Amazon’s retail-plus-cloud mix did not participate. Flagged unrelated — a same-day tech headline is not evidence of causation for a stock that went the other way.',
      },
    ],
  },
  {
    id: 'evt_025',
    date: '2026-06-26T09:30:00-04:00',
    headline: 'Oil prices climb then ease after attack in Strait of Hormuz halts evacuation plan',
    category: 'geopolitical_conflict',
    location: L.hormuz,
    source: {
      outlet: 'Al Jazeera',
      url: 'https://www.aljazeera.com/economy/2026/6/26/oil-prices-climb-after-attack-in-strait-of-hormuz-halts-evacuation-plan',
      published_at: '2026-06-26T09:00:00-04:00',
    },
    related_event_ids: ['evt_023', 'evt_027'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'The reasoning stress-test. A fresh attack headline "should" push oil up and XOM with it — prices spiked, then EASED back as the market weighted ample spare capacity and soft demand over the incident. The naive "conflict → oil up → XOM up" chain did NOT hold. Flagged indirect precisely because the mechanical link broke down; an honest model has to be able to say the obvious story failed.',
      },
      {
        ticker: 'DAL',
        tier: 'indirect',
        direction: 'up',
        reasoning:
          'With crude fading despite the attack, Delta’s fuel outlook was not damaged the way the headline implies. The counterintuitive setup makes this indirect and low-confidence rather than a clean direct read.',
      },
    ],
  },
  {
    id: 'evt_026',
    date: '2026-07-02T09:30:00-04:00',
    headline: 'Tesla delivers 480,126 vehicles in Q2, crushing ~406,600 consensus',
    category: 'company_specific',
    location: L.austin,
    source: {
      outlet: 'Tesla (company release)',
      url: 'https://ir.tesla.com/press-release/tesla-second-quarter-2026-production-deliveries-and-deployments',
      published_at: '2026-07-02T08:00:00-04:00',
    },
    related_event_ids: ['evt_009'],
    impacts: [
      {
        ticker: 'TSLA',
        tier: 'unrelated',
        direction: 'down',
        reasoning:
          'The most uncomfortable case in this dataset, and the one worth sitting with. Tesla delivered 480,126 vehicles against a ~406,600 consensus — a colossal beat, up 25% year-over-year — and the stock fell 7.5% that session. Deliveries are the cleanest read on Tesla’s revenue line, so the naive model says "huge beat → stock up." It did not happen. Because the move went hard against the news, this event is flagged UNRELATED to the decline: whatever drove that 7.5% drop, the delivery number is not it, and inventing a story to reconcile them would be exactly the fabrication this map exists to prevent. The honest statement is that the beat is real, the drop is real, and the delivery report does not explain it.',
      },
    ],
  },
  {
    id: 'evt_027',
    date: '2026-07-07T09:30:00-04:00',
    headline: 'Oil rises after tanker attacks in Strait of Hormuz; U.S. revokes Iran oil-sale license',
    category: 'geopolitical_conflict',
    location: L.hormuz,
    source: {
      outlet: 'CNBC',
      url: 'https://www.cnbc.com/2026/07/07/oil-prices-iran-strait-hormuz.html',
      published_at: '2026-07-07T09:30:00-04:00',
    },
    related_event_ids: ['evt_002', 'evt_025'],
    impacts: [
      {
        ticker: 'XOM',
        tier: 'direct',
        direction: 'up',
        reasoning:
          'Three vessels struck near Hormuz in under 24 hours, and the U.S. then revoked Iran’s oil-sale license. Brent settled 3% higher at $74.16 and popped 5.6% to $76.04 after hours. Tighter supply expectations lift realized prices, directly lifting XOM — the same causal shape as the March 2 Hormuz event.',
      },
      {
        ticker: 'DAL',
        tier: 'direct',
        direction: 'down',
        reasoning:
          'Renewed crude spike raises jet-fuel cost expectations — a direct hit to Delta’s largest variable cost, and the mirror image of the XOM trade.',
      },
    ],
  },
  {
    id: 'evt_028',
    date: '2026-07-07T11:00:00-04:00',
    headline: 'DeepSeek is developing its own AI chip, Reuters reports; Nvidia dips intraday',
    category: 'competitor_news',
    location: L.shenzhen,
    source: {
      outlet: 'Bloomberg (citing Reuters)',
      url: 'https://www.bloomberg.com/news/articles/2026-07-07/chinese-ai-startup-deepseek-developing-own-ai-chip-reuters-says',
      published_at: '2026-07-07T11:00:00-04:00',
    },
    related_event_ids: ['evt_027', 'evt_017'],
    impacts: [
      {
        ticker: 'NVDA',
        tier: 'direct',
        direction: 'none',
        reasoning:
          'Two lessons in one. FIRST, attribution: Nvidia moved on the same day as the tanker-attack oil headline, so a model that blames the biggest story of the day would tie it to Iran. Wrong — the Nvidia-specific news is competitive: Reuters reported DeepSeek is designing its own SMIC-fabricated inference chip to cut its dependence on Nvidia and Huawei. SECOND, data limits: Nvidia dipped intraday on the report but CLOSED slightly higher (+0.7%), so the daily close this system measures shows almost nothing. The reported dip is real and the flat close is real; a daily bar simply cannot see an intraday reaction. Direction is marked "none" rather than pretending the close confirms the story.',
      },
      {
        ticker: 'AVGO',
        tier: 'indirect',
        direction: 'down',
        reasoning:
          'Every large AI customer that designs its own silicon is a customer that buys fewer merchant accelerators. The DeepSeek report is a datapoint in the broader in-house-chip trend, which pressures the whole merchant AI-silicon complex. Indirect — Broadcom is not named in the report.',
      },
    ],
  },
];
