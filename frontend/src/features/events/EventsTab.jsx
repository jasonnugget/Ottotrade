import { useMemo, useState } from 'react';
import { pct } from '../../api.js';
import { tierColor, categoryLabel } from '../../shared/theme.js';
import './events.css';

const ADDED_EVENTS = [
  {
    id: 'event-aapl-q2-2026',
    date: '2026-04-30T00:00:00.000Z',
    headline: 'Apple reports second quarter results with record revenue of $111.2 billion.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 3.0,
    affected_tickers: ['AAPL'],
    source: { outlet: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/2026/04/apple-reports-second-quarter-results/' },
  },
  {
    id: 'event-msft-q3-2026',
    date: '2026-04-29T00:00:00.000Z',
    headline: 'Microsoft Cloud and AI strength fuels third quarter results with $82.9 billion in revenue.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 1.12,
    affected_tickers: ['MSFT'],
    source: { outlet: 'Microsoft News', url: 'https://news.microsoft.com/source/2026/04/29/microsoft-cloud-and-ai-strength-fuels-third-quarter-results/' },
  },
  {
    id: 'event-meta-q1-2026',
    date: '2026-04-29T00:00:00.000Z',
    headline: 'Meta Q1 2026 results show $56.3 billion in revenue and fastest growth since 2021.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: -7.0,
    affected_tickers: ['META'],
    source: { outlet: 'EarningsCall.biz', url: 'https://earningscall.biz/blog/meta-q1-2026-earnings-call' },
  },
  {
    id: 'event-lly-q1-2026',
    date: '2026-04-30T00:00:00.000Z',
    headline: 'Lilly reports first-quarter 2026 financial results with worldwide revenue of $19.8 billion.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 2.45,
    affected_tickers: ['LLY'],
    source: { outlet: 'Lilly Investor Relations', url: 'https://investor.lilly.com/news-releases/news-release-details/lilly-reports-first-quarter-2026-financial-results-raises-full' },
  },
  {
    id: 'event-amzn-ai-silicon-2026',
    date: '2026-07-02T00:00:00.000Z',
    headline: 'Amazon is designing end-to-end custom AI silicon, like its new AZ3 chips, to run AI models directly on devices.',
    category: 'competitor_news',
    confidence_tier: 'indirect',
    magnitude: 2.15,
    affected_tickers: ['AMZN', 'NVDA'],
    source: { outlet: 'TechShots', url: 'https://www.techshotsapp.com/technology/beyond-the-screen-amazon-builds-custom-silicon-to-power-a-conversational-ambience-driven-future-' },
  },
  {
    id: 'event-tsla-fsd-regulation-2026',
    date: '2026-06-15T00:00:00.000Z',
    headline: "Tesla presented misleading 'Full Self-Driving' safety data to European regulators during its approval push.",
    category: 'regulatory',
    confidence_tier: 'direct',
    magnitude: -2.84,
    affected_tickers: ['TSLA'],
    source: { outlet: 'Electrek', url: 'https://electrek.co/2026/06/15/tesla-fsd-misleading-safety-data-european-regulators/' },
  },
  {
    id: 'event-jpm-q1-2026',
    date: '2026-04-14T00:00:00.000Z',
    headline: 'JPMorgan Chase lifts Q1 2026 earnings with net income of $16.5 billion.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 1.42,
    affected_tickers: ['JPM'],
    source: { outlet: 'Stock Titan', url: 'https://www.stocktitan.net/sec-filings/JPM/10-q-jpmorgan-chase-co-quarterly-earnings-report-0cc7e9e7947c.html' },
  },
  {
    id: 'event-hd-q1-2026',
    date: '2026-05-19T00:00:00.000Z',
    headline: 'The Home Depot announces first quarter fiscal 2026 results with sales of $41.8 billion.',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 0.6,
    affected_tickers: ['HD'],
    source: { outlet: 'The Home Depot', url: 'https://corporate.homedepot.com/news/earnings/home-depot-announces-first-quarter-2026-earnings' },
  },
  {
    id: 'event-googl-search-data-2026',
    date: '2026-02-02T00:00:00.000Z',
    headline: "Antitrust enforcers oppose Google's request to stay an order requiring it to share search data with competitors.",
    category: 'regulatory',
    confidence_tier: 'direct',
    magnitude: -3.21,
    affected_tickers: ['GOOGL', 'GOOG'],
    source: { outlet: 'MediaPost', url: 'https://www.mediapost.com/publications/article/412479/doj-fights-googles-premature-request-to-stay-an.html' },
  },
  {
    id: 'event-avgo-aapl-chip-deal-2026',
    date: '2026-07-06T00:00:00.000Z',
    headline: 'Broadcom extends its custom-silicon partnership with Apple through 2031.',
    category: 'company_specific',
    confidence_tier: 'direct',
    magnitude: 4.69,
    affected_tickers: ['AVGO', 'AAPL'],
    source: { outlet: 'The Next Web', url: 'https://thenextweb.com/news/broadcom-apple-extend-chip-deal-2031' },
  },
  {
    id: 'event-msft-copilot-complaint-2026',
    date: '2026-01-28T00:00:00.000Z',
    headline: 'Microsoft Copilot functionality issues trigger securities fraud complaint after Q2 2026 growth slows',
    category: 'company_specific',
    confidence_tier: 'direct',
    magnitude: -10.0,
    affected_tickers: ['MSFT'],
    source: { outlet: 'National Law Review', url: 'https://natlawreview.com/press-releases/microsoft-nasdaq-msft-copilot-functionality-issues-trigger-securities-fraud' },
  },
  {
    id: 'event-nvda-q4-2026-earnings',
    date: '2026-02-25T00:00:00.000Z',
    headline: 'Nvidia Q4 2026 earnings blowout tops Wall Street expectations',
    category: 'earnings',
    confidence_tier: 'direct',
    magnitude: 1.0,
    affected_tickers: ['NVDA'],
    source: { outlet: 'Kiplinger', url: 'https://www.kiplinger.com/investing/live/nvidia-earnings-live-updates-and-commentary-february-2026' },
  },
  {
    id: 'event-aapl-memory-chip-costs-2026',
    date: '2026-06-17T00:00:00.000Z',
    headline: 'Apple plans price increases as memory chip costs rise',
    category: 'company_specific',
    confidence_tier: 'direct',
    magnitude: -1.5,
    affected_tickers: ['AAPL'],
    source: { outlet: 'AlphaSpread', url: 'https://www.alphaspread.com/market-news/corporate-moves/openai-is-reportedly-exploring-legal-action-against-apple-over-their-partnership' },
  },
  {
    id: 'event-msft-layoffs-2026',
    date: '2026-07-06T00:00:00.000Z',
    headline: 'Microsoft joins AI-driven tech layoff wave with 4,800 job cuts due to mounting data center costs',
    category: 'company_specific',
    confidence_tier: 'direct',
    magnitude: -0.5,
    affected_tickers: ['MSFT'],
    source: { outlet: 'The Financial Express', url: 'https://thefinancialexpress.com.bd/sci-tech/microsoft-joins-ai-driven-tech-layoff-wave-with-4800-job-cuts' },
  },
  {
    id: 'event-msft-uk-suppliers-2026',
    date: '2026-07-10T00:00:00.000Z',
    headline: 'UK designates Microsoft, Google, Amazon, and Oracle as critical third-party suppliers to financial sector',
    category: 'regulatory',
    confidence_tier: 'direct',
    magnitude: -0.75,
    affected_tickers: ['MSFT', 'GOOGL', 'AMZN', 'ORCL'],
    source: { outlet: 'Global Banking and Finance', url: 'https://www.globalbankingandfinance.com/uk-regulate-cloud-service-providers-microsoft-google-others/' },
  },
].map((event) => ({ ...event, ts: new Date(event.date).getTime() }));

// Dedicated, filterable feed of every event — a starting scaffold for the Events
// owner to redesign. Clicking a row drills into that event's stock in Explore.
export default function EventsTab({ events, onOpenEvent }) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const existingIds = new Set((events || []).map((event) => event.id));
    const list = [...(events || []), ...ADDED_EVENTS.filter((event) => !existingIds.has(event.id))]
      .sort((a, b) => b.ts - a.ts);
    const normalizedQuery = query.trim().toLowerCase();

    return list.filter((event) => {
      const searchable = [
        event.headline,
        event.category,
        categoryLabel(event.category),
        event.date?.slice(0, 10),
        ...(event.affected_tickers || []),
      ].join(' ').toLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });
  }, [events, query]);

  return (
    <div className="events-tab">
      <header className="events-header">
        <div>
          <h1>Events</h1>
          <p className="muted tiny"></p>
        </div>
      </header>

      <label className="events-search">
        <span className="sr-only">Search events</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search events, tickers, or categories"
        />
      </label>

      <div className="card">
        <div className="card-head">
          <h2>{sorted.length} event{sorted.length === 1 ? '' : 's'}</h2>
        </div>
        <div className="feed">
          {sorted.map((e) => (
            <button className="feed-row" key={e.id} onClick={() => onOpenEvent(e)}>
              <span className="feed-dot" style={{ background: tierColor(e.confidence_tier) }} />
              <div className="feed-body">
                <div className="feed-head">{e.headline}</div>
                <div className="muted tiny">
                  {e.date.slice(0, 10)} · {categoryLabel(e.category)} · {e.affected_tickers.join(', ')}
                </div>
              </div>
              <div className={`feed-mag ${e.confidence_tier}`}>
                {e.magnitude ? pct(e.magnitude / 100) : ''}
              </div>
            </button>
          ))}
          {!sorted.length && <p className="events-empty muted">No events match your search.</p>}
        </div>
      </div>
    </div>
  );
}
