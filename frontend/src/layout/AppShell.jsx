import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import useAppData from '../shared/useAppData.js';
import { subgraphForStock } from '../shared/graphUtils.js';
import TimelineScrubber from '../shared/TimelineScrubber.jsx';
import '../shared/shared.css';
import Sidebar from './Sidebar.jsx';
import './AppShell.css';
import HomeTab from '../features/home/HomeTab.jsx';
import PortfolioTab from '../features/portfolio/PortfolioTab.jsx';
import ExploreTab from '../features/explore/ExploreTab.jsx';
import EventsTab from '../features/events/EventsTab.jsx';
import AnalysisTab from '../features/analysis/AnalysisTab.jsx';

const TAB_LABEL = { home: 'Home', portfolio: 'Portfolio', events: 'Events', analysis: 'Analysis' };

// App shell: owns the sidebar + the one shared data source (useAppData). Navigation is
// URL-driven (/home, /portfolio, /explore, /explore/AAPL, /events, /analysis), so tabs are
// linkable, refreshable, and work with the browser's back button.
//
// Each tab below only needs the props it's handed here — teams can redesign the inside of
// features/<tab>/ freely without touching this file or each other.
//
// Tabs render as soon as the shell mounts; they don't wait on a single global "everything
// is loaded" gate. Every prop pulled from `data` already has a safe default (see
// useAppData.js), so a tab whose data hasn't arrived yet just renders its empty state
// instead of blocking navigation to the other tabs.
export default function AppShell({ user }) {
  const data = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  // Which tab the sidebar should highlight, derived from the URL rather than kept in state.
  const activeTab = location.pathname.split('/')[1] || 'home';

  // Where an Explore drill-in came from, so its back button knows where to return. This is
  // navigation history, not app state, so it rides along in the location instead of a ref.
  const exploreOrigin = location.state?.from ?? null;
  const [selected, setSelected] = useState(null); // {id, type:'event'}

  const selectedEvent = selected?.type === 'event' ? data.eventsById[selected.id] : null;
  const related = selectedEvent
    ? (selectedEvent.related_event_ids || []).map((id) => data.eventsById[id]).filter(Boolean)
    : [];

  // Sidebar navigation. Going to /explore (no symbol) always lands on the stock picker —
  // that's the fix for "Explore gets stuck on the last stock you looked at."
  const selectTab = (nextTab) => {
    setSelected(null);
    navigate(`/${nextTab}`);
  };
  const openPortfolio = () => selectTab('portfolio');

  const openStock = (symbol) => {
    setSelected(null);
    navigate(`/explore/${symbol}`, { state: { from: activeTab } });
  };
  const openEventFromFeed = (event) => {
    // drill into the event's primary stock in Explore; fall back to the Home event web
    const symbol = event.affected_tickers?.[0];
    setSelected({ id: event.id, type: 'event' });
    if (symbol) navigate(`/explore/${symbol}`, { state: { from: activeTab } });
    else navigate('/home');
  };
  // Picking a stock from Explore's own list (rather than drilling in from another tab) —
  // back should return to that list, not jump to a different tab.
  const pickExploreSymbol = (symbol) => {
    setSelected(null);
    navigate(`/explore/${symbol}`, { state: { from: 'explore' } });
  };
  const exploreBack = () => {
    setSelected(null);
    navigate(exploreOrigin && exploreOrigin !== 'explore' ? `/${exploreOrigin}` : '/explore');
  };
  const exploreBackLabel = exploreOrigin && exploreOrigin !== 'explore'
    ? TAB_LABEL[exploreOrigin] || exploreOrigin
    : 'all stocks';

  const tabProps = {
    data,
    selected,
    setSelected,
    selectedEvent,
    related,
    openStock,
    openPortfolio,
    openEventFromFeed,
    pickExploreSymbol,
    exploreBack,
    exploreBackLabel,
  };

  return (
    <div className="app-shell">
      <Sidebar active={activeTab} onSelect={selectTab} user={user} />
      <div className="app-content">
        {data.error && <div className="card err">Couldn't load: {data.error}</div>}

        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/home"
            element={
              <HomeTab
                graph={data.visibleGraph}
                visibleEvents={data.visibleEvents}
                eventsById={data.eventsById}
                selectedEvent={selectedEvent}
                related={related}
                live={data.live}
                timeline={data.timeline}
                currentTs={data.currentTs}
                onSelectEvent={setSelected}
                onOpenStock={openStock}
                onOpenPortfolio={openPortfolio}
                enrich={data.enrichFor(selectedEvent ? selectedEvent.id : '_')}
              />
            }
          />
          <Route
            path="/portfolio"
            element={
              <PortfolioTab
                live={data.live}
                timeline={data.timeline}
                stocks={data.stocks}
                onOpenStock={openStock}
                onPortfolioChange={data.refreshPortfolio}
              />
            }
          />
          <Route path="/explore" element={<ExploreRoute {...tabProps} />} />
          <Route path="/explore/:symbol" element={<ExploreRoute {...tabProps} />} />
          <Route
            path="/events"
            element={
              <EventsTab events={data.events} eventsById={data.eventsById} onOpenEvent={openEventFromFeed} />
            }
          />
          <Route path="/analysis" element={<AnalysisTab live={data.live} events={data.events} />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// Explore reads its stock from the URL, so /explore/AAPL is a real, shareable link.
function ExploreRoute({
  data,
  selectedEvent,
  related,
  setSelected,
  pickExploreSymbol,
  exploreBack,
  exploreBackLabel,
}) {
  const { symbol: rawSymbol } = useParams();
  const symbol = rawSymbol ? rawSymbol.toUpperCase() : null;
  // A URL pointing at a stock that isn't tradable (typo, or a ticker we dropped from the
  // universe) falls back to the picker instead of rendering an empty chart.
  const known = symbol && data.stocks?.[symbol] ? symbol : null;

  const subgraph = useMemo(
    () => (known ? subgraphForStock(data.visibleGraph, known) : null),
    [data.visibleGraph, known]
  );

  const scrubberVisible = !!known && data.timeline?.points?.length > 0;

  return (
    <>
      <ExploreTab
        symbol={known}
        name={known ? data.stocks[known]?.name : null}
        subgraph={subgraph}
        eventsById={data.eventsById}
        position={(data.live?.positions || []).find((p) => p.symbol === known)}
        positions={data.live?.positions || []}
        stocks={data.stocks}
        quotes={data.quotes}
        selectedEvent={selectedEvent}
        related={related}
        onSelect={setSelected}
        onPickSymbol={pickExploreSymbol}
        onBack={exploreBack}
        backLabel={exploreBackLabel}
        enrich={data.enrichFor(selectedEvent ? selectedEvent.id : '_')}
      />
      {/* An empty portfolio has no value series, so timeline.start/end are undefined and the
          scrubber would compute a NaN span. Only render it when there's something to scrub. */}
      {scrubberVisible && (
        <TimelineScrubber timeline={data.timeline} currentTs={data.currentTs} onChange={data.setCurrentTs} />
      )}
    </>
  );
}
