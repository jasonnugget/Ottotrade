import { useMemo, useState } from 'react';
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
import GuidanceTab from '../features/guidance/GuidanceTab.jsx';

const TAB_LABEL = { home: 'Home', portfolio: 'Portfolio', events: 'Events', guidance: 'Guidance' };

// App shell: owns the sidebar route + the one shared data source (useAppData).
// Each tab below only needs the props it's handed here — teams can redesign the
// inside of features/<tab>/ freely without touching this file or each other.
//
// Tabs render as soon as the shell mounts; they don't wait on a single global
// "everything is loaded" gate. Every prop pulled from `data` already has a safe
// default (see useAppData.js), so a tab whose data hasn't arrived yet just renders
// its empty state instead of blocking navigation to the other tabs.
export default function AppShell() {
  const data = useAppData();
  const [tab, setTab] = useState('home');
  const [exploreSymbol, setExploreSymbol] = useState(null);
  const [exploreOrigin, setExploreOrigin] = useState(null); // tab id, or 'explore' for "back to the list"
  const [selected, setSelected] = useState(null); // {id, type:'event'}

  const selectedEvent = selected?.type === 'event' ? data.eventsById[selected.id] : null;
  const related = selectedEvent
    ? (selectedEvent.related_event_ids || []).map((id) => data.eventsById[id]).filter(Boolean)
    : [];

  // Explicit sidebar navigation. Clicking Explore here always resets to the
  // stock-picker list — it's the fix for "Explore gets stuck on the last stock."
  const selectTab = (nextTab) => {
    setSelected(null);
    if (nextTab === 'explore') {
      setExploreSymbol(null);
      setExploreOrigin(null);
    }
    setTab(nextTab);
  };
  const openHome = () => selectTab('home');

  const openStock = (symbol) => {
    setSelected(null);
    setExploreOrigin(tab); // remember which tab this drill-in started from
    setExploreSymbol(symbol);
    setTab('explore');
  };
  const openEventFromFeed = (e) => {
    // drill into the event's primary stock in Explore; fall back to the Home event web
    const sym = e.affected_tickers?.[0];
    setSelected({ id: e.id, type: 'event' });
    if (sym) {
      setExploreOrigin(tab);
      setExploreSymbol(sym);
      setTab('explore');
    } else {
      setTab('home');
    }
  };
  // Picking a stock from Explore's own list (not a drill-in from another tab) —
  // back should return to that list, not jump to a different tab.
  const pickExploreSymbol = (sym) => {
    setSelected(null);
    setExploreOrigin('explore');
    setExploreSymbol(sym);
  };
  const exploreBack = () => {
    setSelected(null);
    setExploreSymbol(null);
    if (exploreOrigin && exploreOrigin !== 'explore') setTab(exploreOrigin);
    setExploreOrigin(null);
  };
  const exploreBackLabel = exploreOrigin && exploreOrigin !== 'explore'
    ? `${TAB_LABEL[exploreOrigin] || exploreOrigin}`
    : 'all stocks';

  const exploreSubgraph = useMemo(
    () => (exploreSymbol ? subgraphForStock(data.visibleGraph, exploreSymbol) : null),
    [data.visibleGraph, exploreSymbol]
  );

  const scrubberVisible = tab === 'explore' && !!data.timeline;

  return (
    <div className="app-shell">
      <Sidebar active={tab} onSelect={selectTab} />
      <div className="app-content">
        {data.error && <div className="card err">Couldn't load: {data.error}</div>}

        {tab === 'home' && (
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
            enrich={data.enrichFor(selectedEvent ? selectedEvent.id : '_')}
          />
        )}

        {tab === 'portfolio' && (
          <PortfolioTab
            live={data.live}
            timeline={data.timeline}
            stocks={data.stocks}
            onOpenStock={openStock}
            onOpenWeb={openHome}
          />
        )}

        {tab === 'explore' && (
          <ExploreTab
            symbol={exploreSymbol}
            name={exploreSymbol ? data.stocks[exploreSymbol]?.name : null}
            subgraph={exploreSubgraph}
            eventsById={data.eventsById}
            position={(data.live?.positions || []).find((p) => p.symbol === exploreSymbol)}
            positions={data.live?.positions || []}
            stocks={data.stocks}
            selectedEvent={selectedEvent}
            related={related}
            onSelect={setSelected}
            onPickSymbol={pickExploreSymbol}
            onBack={exploreBack}
            backLabel={exploreBackLabel}
            enrich={data.enrichFor(selectedEvent ? selectedEvent.id : '_')}
          />
        )}

        {tab === 'events' && (
          <EventsTab events={data.events} eventsById={data.eventsById} onOpenEvent={openEventFromFeed} />
        )}

        {tab === 'guidance' && <GuidanceTab live={data.live} events={data.events} />}

        {scrubberVisible && (
          <TimelineScrubber timeline={data.timeline} currentTs={data.currentTs} onChange={data.setCurrentTs} />
        )}
      </div>
    </div>
  );
}
