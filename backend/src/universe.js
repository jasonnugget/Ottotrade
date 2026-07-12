// The tradable universe: every ticker a user can add to their portfolio.
//
// Price bars are seeded into Supabase for all of these (see backend/scripts/fetchUniverse.js),
// which is what makes them valuable in the portfolio. Adding a ticker here means re-running
// the fetch + seed scripts, otherwise the frontend has nothing to price it with.
//
// The original 7 (AAPL, TSLA, NVDA, AMZN, MSFT, XOM, DAL) are the ones with curated event
// data attached; the rest are priceable but have no event web yet.

// Kept to 15 tickers on purpose: every ticker here means ~450 more rows of price bars in
// seed.sql, and the Supabase SQL Editor rejects the file once it gets too large. Adding
// one back is fine — just re-run fetchUniverse + seed and watch the file size.
export const UNIVERSE = {
  // The original 7 — these are the ones with curated event data attached.
  AAPL: { name: 'Apple', sector: 'Consumer tech / hardware' },
  MSFT: { name: 'Microsoft', sector: 'Cloud / enterprise software' },
  NVDA: { name: 'Nvidia', sector: 'Semiconductors / AI' },
  AMZN: { name: 'Amazon', sector: 'E-commerce / cloud' },
  TSLA: { name: 'Tesla', sector: 'EV / auto / energy' },
  XOM: { name: 'ExxonMobil', sector: 'Energy / oil & gas' },
  DAL: { name: 'Delta Air Lines', sector: 'Airlines / travel' },

  // Priceable, but no event web yet. One per major sector rather than a long tail.
  GOOGL: { name: 'Alphabet Class A', sector: 'Search / advertising / cloud' },
  META: { name: 'Meta Platforms', sector: 'Social / advertising' },
  AVGO: { name: 'Broadcom', sector: 'Semiconductors / infrastructure' },
  JPM: { name: 'JPMorgan Chase', sector: 'Banking / financials' },
  WMT: { name: 'Walmart', sector: 'Retail / consumer staples' },
  LLY: { name: 'Eli Lilly', sector: 'Pharmaceuticals' },
  V: { name: 'Visa', sector: 'Payments / financials' },
  NFLX: { name: 'Netflix', sector: 'Streaming / media' },
};

export const UNIVERSE_SYMBOLS = Object.keys(UNIVERSE);
