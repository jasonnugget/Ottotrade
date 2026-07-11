import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { subgraphForStock } from './graphUtils.js';
import TimelineScrubber from './TimelineScrubber.jsx';
import HomeDashboard from './HomeDashboard.jsx';
import StockView from './StockView.jsx';
import WebView from './WebView.jsx';

const LIVE_POLL_MS = 20000;

export default function BubbleApp() {
  const [timeline, setTimeline] = useState(null);
  const [fullGraph, setFullGraph] = useState(null);
  const [events, setEvents] = useState(null);
  const [stocks, setStocks] = useState({});
  const [live, setLive] = useState(null);
  const [enrichAvail, setEnrichAvail] = useState(false);
  const [currentTs, setCurrentTs] = useState(null);
  const [route, setRoute] = useState({ name: 'home' }); // home | {stock} | web
  const [selected, setSelected] = useState(null); // {id, type:'event'}
  const [ai, setAi] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.timeline(), api.graph(), api.events(), api.stocks(), api.enrichStatus()])
      .then(([tl, g, ev, st, es]) => {
        setTimeline(tl);
        setFullGraph(g);
        setEvents(ev);
        setStocks(st);
        setEnrichAvail(es.available);
        setCurrentTs(tl.end);
      })
      .catch((e) => setError(e.message));
    api.live().then(setLive).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => api.live().then(setLive).catch(() => {}), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const eventsById = useMemo(() => {
    const m = {};
    for (const e of events || []) m[e.id] = e;
    return m;
  }, [events]);

  const visibleGraph = useMemo(() => {
    if (!fullGraph) return { nodes: [], edges: [] };
    const cut = currentTs ?? Infinity;
    const nodes = fullGraph.nodes.filter((n) => n.type === 'stock' || n.ts <= cut);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = fullGraph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [fullGraph, currentTs]);

  const visibleEvents = useMemo(
    () => (events || []).filter((e) => e.ts <= (currentTs ?? Infinity)),
    [events, currentTs]
  );

  const selectedEvent = selected?.type === 'event' ? eventsById[selected.id] : null;
  const related = selectedEvent
    ? (selectedEvent.related_event_ids || []).map((id) => eventsById[id]).filter(Boolean)
    : [];

  const runEnrich = (id) => {
    setAi((s) => ({ ...s, [id]: { loading: true } }));
    api
      .enrich(id)
      .then((res) => setAi((s) => ({ ...s, [id]: { result: res.ai } })))
      .catch((e) => setAi((s) => ({ ...s, [id]: { error: e.message } })));
  };
  const enrichFor = (id) => ({
    available: enrichAvail,
    result: ai[id]?.result,
    loading: ai[id]?.loading,
    error: ai[id]?.error,
    run: runEnrich,
  });

  const openStock = (symbol) => {
    setSelected(null);
    setRoute({ name: 'stock', symbol });
  };
  const openWeb = () => {
    setSelected(null);
    setRoute({ name: 'web' });
  };
  const openHome = () => {
    setSelected(null);
    setRoute({ name: 'home' });
  };
  const openEventFromFeed = (e) => {
    // from the home feed, drill into the event's primary stock and select the event
    const sym = e.affected_tickers?.[0];
    setSelected({ id: e.id, type: 'event' });
    setRoute(sym ? { name: 'stock', symbol: sym } : { name: 'web' });
  };

  if (error)
    return <div className="bubble-app"><div className="card err">Couldn't load: {error}</div></div>;
  if (!timeline || !fullGraph || !live)
    return <div className="bubble-app"><div className="placeholder big">Building the web of connections…</div></div>;

  const scrubberVisible = route.name !== 'home';

  return (
    <div className="bubble-app">
      {route.name === 'home' && (
        <HomeDashboard
          live={live}
          timeline={timeline}
          events={events}
          stocks={stocks}
          onOpenStock={openStock}
          onOpenWeb={openWeb}
          onOpenEvent={openEventFromFeed}
        />
      )}

      {route.name === 'stock' && (
        <StockView
          symbol={route.symbol}
          name={stocks[route.symbol]?.name}
          subgraph={subgraphForStock(visibleGraph, route.symbol)}
          eventsById={eventsById}
          position={(live.positions || []).find((p) => p.symbol === route.symbol)}
          selectedEvent={selectedEvent}
          related={related}
          onSelect={setSelected}
          onBack={openHome}
          enrich={selectedEvent ? enrichFor(selectedEvent.id) : enrichFor('_')}
        />
      )}

      {route.name === 'web' && (
        <WebView
          graph={visibleGraph}
          visibleEvents={visibleEvents}
          eventsById={eventsById}
          selectedEvent={selectedEvent}
          related={related}
          live={live}
          timeline={timeline}
          currentTs={currentTs}
          onSelectEvent={setSelected}
          onOpenStock={openStock}
          onBack={openHome}
          enrich={selectedEvent ? enrichFor(selectedEvent.id) : enrichFor('_')}
        />
      )}

      {scrubberVisible && (
        <TimelineScrubber timeline={timeline} currentTs={currentTs} onChange={setCurrentTs} />
      )}
    </div>
  );
}
