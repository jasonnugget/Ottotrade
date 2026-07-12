// The tradable universe: every ticker a user can add to their portfolio.
//
// Price bars are seeded into Supabase for all of these (see backend/scripts/fetchUniverse.js),
// which is what makes them valuable in the portfolio. Adding a ticker here means re-running
// the fetch + seed scripts, otherwise the frontend has nothing to price it with.
//
// The original 7 (AAPL, TSLA, NVDA, AMZN, MSFT, XOM, DAL) are the ones with curated event
// data attached; the rest are priceable but have no event web yet.

export const UNIVERSE = {
  AAPL: { name: 'Apple', sector: 'Consumer tech / hardware' },
  MSFT: { name: 'Microsoft', sector: 'Cloud / enterprise software' },
  NVDA: { name: 'Nvidia', sector: 'Semiconductors / AI' },
  AMZN: { name: 'Amazon', sector: 'E-commerce / cloud' },
  TSLA: { name: 'Tesla', sector: 'EV / auto / energy' },
  XOM: { name: 'ExxonMobil', sector: 'Energy / oil & gas' },
  DAL: { name: 'Delta Air Lines', sector: 'Airlines / travel' },
  GOOGL: { name: 'Alphabet Class A', sector: 'Search / advertising / cloud' },
  META: { name: 'Meta Platforms', sector: 'Social / advertising' },
  AVGO: { name: 'Broadcom', sector: 'Semiconductors / infrastructure' },
  'BRK-B': { name: 'Berkshire Hathaway', sector: 'Diversified holding' },
  JPM: { name: 'JPMorgan Chase', sector: 'Banking / financials' },
  WMT: { name: 'Walmart', sector: 'Retail / consumer staples' },
  LLY: { name: 'Eli Lilly', sector: 'Pharmaceuticals' },
  V: { name: 'Visa', sector: 'Payments / financials' },
  MA: { name: 'Mastercard', sector: 'Payments / financials' },
  NFLX: { name: 'Netflix', sector: 'Streaming / media' },
  COST: { name: 'Costco', sector: 'Retail / consumer staples' },
  ORCL: { name: 'Oracle', sector: 'Enterprise software / cloud' },
  HD: { name: 'Home Depot', sector: 'Retail / home improvement' },
  PG: { name: 'Procter & Gamble', sector: 'Consumer staples' },
  ABBV: { name: 'AbbVie', sector: 'Pharmaceuticals' },
  BAC: { name: 'Bank of America', sector: 'Banking / financials' },
  KO: { name: 'Coca-Cola', sector: 'Beverages / consumer staples' },
  CRM: { name: 'Salesforce', sector: 'Enterprise software' },
};

export const UNIVERSE_SYMBOLS = Object.keys(UNIVERSE);
