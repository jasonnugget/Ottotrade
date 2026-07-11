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

// App shell: owns the sidebar route + the one shared data source (useAppData).
// Each tab below only needs the props it's handed here — teams can redesign the
// inside of features/<tab>/ freely without touching this file or each other.
export default function AppShell() {
  const data = useAppData();
  const [tab, setTab] = useState('home');
  const [exploreSymbol, setExploreSymbol] = useState(null);
  const [selected, setSelected] = useState(null); // {id, type:'event'}

  const selectedEvent = selected?.type === 'event' ? data.eventsById[selected.id] : null;
  const related = selectedEvent
    ? (selectedEvent.related_event_ids || []).map((id) => data.eventsById[id]).filter(Boolean)
    : [];

  const goTo = (nextTab) => {
    setSelected(null);
    setTab(nextTab);
  };
  const openHome = () => goTo('home');
  const openStock = (symbol) => {
    setSelected(null);
    setExploreSymbol(symbol);
    setTab('explore');
  };
  const openEventFromFeed = (e) => {
    // drill into the event's primary stock in Explore; fall back to the Home event web
    const sym = e.affected_tickers?.[0];
    setSelected({ id: e.id, type: 'event' });
    if (sym) {
      setExploreSymbol(sym);
      setTab('explore');
    } else {
      setTab('home');
    }
  };

  const exploreSubgraph = useMemo(
    () => (exploreSymbol ? subgraphForStock(data.visibleGraph, exploreSymbol) : null),
    [data.visibleGraph, exploreSymbol]
  );

  if (data.error)
    return <div className="app-shell"><div className="card err">Couldn't load: {data.error}</div></div>;
  if (!data.ready)
    return <div className="app-shell"><div className="placeholder big">Building the web of connections…</div></div>;

  const scrubberVisible = tab === 'home' || tab === 'explore';

  return (
    <div className="app-shell">
      <Sidebar active={tab} onSelect={goTo} />
      <div className="app-content">
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
            events={data.events}
            stocks={data.stocks}
            onOpenStock={openStock}
            onOpenWeb={openHome}
            onOpenEvent={openEventFromFeed}
          />
        )}

        {tab === 'explore' && (
          <ExploreTab
            symbol={exploreSymbol}
            name={exploreSymbol ? data.stocks[exploreSymbol]?.name : null}
            subgraph={exploreSubgraph}
            eventsById={data.eventsById}
            position={(data.live.positions || []).find((p) => p.symbol === exploreSymbol)}
            positions={data.live.positions || []}
            stocks={data.stocks}
            selectedEvent={selectedEvent}
            related={related}
            onSelect={setSelected}
            onPickSymbol={(sym) => {
              setSelected(null);
              setExploreSymbol(sym);
            }}
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
