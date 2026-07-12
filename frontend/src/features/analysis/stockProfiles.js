// Curated reference profiles for the portfolio universe.
//
// This is qualitative context (what KIND of company is this), deliberately kept separate
// from the price-derived volatility stats computed in AnalysisTab.jsx — the model is told
// to treat this as reference data, never as evidence of price behavior.
//
// Why it exists: without it, the analyst has no way to know that a -3% day on a mega-cap
// blue chip is routine noise while the same move on a high-beta name means something
// different. It's the difference between "sell Apple" and "this is a normal Tuesday."

const PROFILES = {
  AAPL: {
    marketCapTier: 'mega',
    stability: 'blue-chip',
    dividendPayer: true,
    characterization: 'Mega-cap consumer hardware/services with a large installed base, deep cash reserves, and heavy buybacks. Diversified revenue; historically mean-reverts after single-headline shocks.',
  },
  MSFT: {
    marketCapTier: 'mega',
    stability: 'blue-chip',
    dividendPayer: true,
    characterization: 'Mega-cap enterprise software/cloud with recurring subscription revenue and a fortress balance sheet. Among the lowest-volatility mega-caps.',
  },
  AMZN: {
    marketCapTier: 'mega',
    stability: 'blue-chip growth',
    dividendPayer: false,
    characterization: 'Mega-cap e-commerce plus AWS cloud. Blue-chip scale but growth-weighted valuation, so it carries more multiple-compression risk than a classic defensive blue chip.',
  },
  NVDA: {
    marketCapTier: 'mega',
    stability: 'high-beta growth',
    dividendPayer: false,
    characterization: 'Mega-cap semiconductor with AI-cycle exposure. Mega-cap size but high-beta behavior: large daily swings are normal, and it is sensitive to competitor and supply-chain headlines.',
  },
  TSLA: {
    marketCapTier: 'large',
    stability: 'high-beta',
    dividendPayer: false,
    characterization: 'High-beta EV/energy name with a sentiment- and narrative-driven valuation. Routinely posts large single-day moves unrelated to fundamentals; historically the most volatile holding in this portfolio.',
  },
  XOM: {
    marketCapTier: 'mega',
    stability: 'cyclical value',
    dividendPayer: true,
    characterization: 'Mega-cap integrated energy. Commodity-linked: moves with crude prices and geopolitical supply shocks rather than company-specific news. Long dividend history.',
  },
  DAL: {
    marketCapTier: 'mid',
    stability: 'cyclical',
    dividendPayer: true,
    characterization: 'Airline with high operating leverage and thin margins. Structurally sensitive to fuel costs, travel demand, and macro shocks; the least defensive holding in this portfolio.',
  },
};

const FALLBACK = {
  marketCapTier: 'unknown',
  stability: 'unknown',
  dividendPayer: null,
  characterization: 'No curated profile is available for this ticker. Judge it on the supplied price data alone and treat company-quality context as unavailable.',
};

export function stockProfile(symbol) {
  return PROFILES[symbol] || FALLBACK;
}
