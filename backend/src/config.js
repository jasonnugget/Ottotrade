// Portfolio configuration.
//
// NOTE ON THE STOCK SET: the original request listed AAPL, TSLA, NVDA, MSFT, XOM, DAL
// for the initial buy, but the explicit allocation lists 7 names including AMZN and only
// sums to 100% with all 7. We therefore use all 7 names exactly as the allocation was written.

export const CAPITAL = 50000; // USD invested at purchase

// Target weights (sum = 1.00)
export const ALLOCATION = {
  AAPL: 0.20,
  TSLA: 0.16,
  NVDA: 0.14,
  AMZN: 0.14,
  MSFT: 0.12,
  XOM: 0.14,
  DAL: 0.10,
};

export const SYMBOLS = Object.keys(ALLOCATION);

// Eastern Standard Time is UTC-5 (Feb/Mar are winter -> EST, not EDT).
// 11:00 AM EST == 16:00:00 UTC.
const EST_OFFSET_HOURS = -5;

function estToUnix(dateStr, hour) {
  // dateStr = 'YYYY-MM-DD', hour in EST. Returns unix seconds.
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcHour = hour - EST_OFFSET_HOURS; // 11 - (-5) = 16 UTC
  return Math.floor(Date.UTC(y, m - 1, d, utcHour, 0, 0) / 1000);
}

// "A week before March 2nd" -> Feb 23, 2026 (both Mondays / trading days).
export const PURCHASE_DATE = '2026-02-23';
export const SNAPSHOT_DATE = '2026-03-02';
export const SNAPSHOT_HOUR_EST = 11;

export const PURCHASE_TS = estToUnix(PURCHASE_DATE, SNAPSHOT_HOUR_EST); // Feb 23, 11:00 EST
export const SNAPSHOT_TS = estToUnix(SNAPSHOT_DATE, SNAPSHOT_HOUR_EST); // Mar 2, 11:00 EST

export const META = {
  capital: CAPITAL,
  allocation: ALLOCATION,
  symbols: SYMBOLS,
  purchase: { date: PURCHASE_DATE, hourEst: SNAPSHOT_HOUR_EST, ts: PURCHASE_TS },
  snapshot: { date: SNAPSHOT_DATE, hourEst: SNAPSHOT_HOUR_EST, ts: SNAPSHOT_TS },
};
