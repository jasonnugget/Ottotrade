// Fetches the price bars needed to seed Supabase for the full tradable universe.
//
// The portfolio is now user-built (any universe ticker can be added), so bars are no
// longer only needed for the 7 seeded holdings — every ticker a user could pick has to
// be priceable. Run this before scripts/generate-supabase-seed.mjs.
//
//   node backend/scripts/fetchUniverse.js
//
// Results land in backend/cache (gitignored) and are reused on re-runs.

import { getChart } from '../src/yahoo.js';
import { UNIVERSE } from '../src/universe.js';
import { PURCHASE_TS } from '../src/config.js';

const DAY = 86400;
// Enough history for the charts, the volatility stats in the Analysis tab, and any
// purchase date a user might backdate a lot to.
const DAILY_START = PURCHASE_TS - 400 * DAY;
const DAILY_END = Math.floor(Date.now() / 1000);

const symbols = Object.keys(UNIVERSE);
const failures = [];

for (const [index, symbol] of symbols.entries()) {
  const label = `[${index + 1}/${symbols.length}] ${symbol}`;
  try {
    const daily = await getChart(symbol, { interval: '1d', period1: DAILY_START, period2: DAILY_END }, { ttlMs: 0 });
    // Hourly is what the seed generator interpolates a point-in-time buy price from.
    const hourly = await getChart(symbol, { interval: '1h', period1: PURCHASE_TS - 10 * DAY, period2: PURCHASE_TS + 10 * DAY }, { ttlMs: 0 });
    const intraday = await getChart(symbol, { interval: '5m', range: '1d' }, { ttlMs: 0 });
    console.log(`${label}: ${daily.bars.length} daily, ${hourly.bars.length} hourly, ${intraday.bars.length} intraday`);
    if (!daily.bars.length) failures.push(`${symbol} (no daily bars)`);
  } catch (error) {
    console.error(`${label}: FAILED — ${error.message}`);
    failures.push(`${symbol} (${error.message})`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} symbol(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nFetched all ${symbols.length} symbols. Next: npm run seed:supabase`);
