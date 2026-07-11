// Refreshes backend/cache/ with current Yahoo Finance data for every portfolio symbol,
// covering from just before the purchase date through today. Run this before
// `npm run seed:supabase` (in frontend portfolio/) whenever the cached price bars
// no longer reach far enough forward to cover the curated events' dates.
import { getChart } from '../src/yahoo.js';
import { SYMBOLS, PURCHASE_TS } from '../src/config.js';

const NOW = Math.floor(Date.now() / 1000);
const PERIOD1 = PURCHASE_TS - 14 * 86400; // two weeks of buffer before purchase
const PERIOD2 = NOW + 86400; // include today's session

async function main() {
  for (const symbol of SYMBOLS) {
    console.log(`Fetching ${symbol}...`);
    const daily = await getChart(symbol, { interval: '1d', period1: PERIOD1, period2: PERIOD2 }, { ttlMs: 0 });
    const hourly = await getChart(symbol, { interval: '1h', period1: PERIOD1, period2: PERIOD2 }, { ttlMs: 0 });
    const intraday = await getChart(symbol, { interval: '5m', range: '1d' }, { ttlMs: 0 });
    console.log(
      `  ${symbol}: ${daily.bars.length} daily bars, ${hourly.bars.length} hourly bars, ${intraday.bars.length} intraday bars`
    );
  }
  console.log('Done. Cache written to backend/cache/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
