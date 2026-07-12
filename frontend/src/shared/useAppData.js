import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const LIVE_POLL_MS = 20000;

// Single shared data source for every sidebar tab: timeline, graph, events, stocks,
// live portfolio data, and AI-enrichment. This is the data "contract" tabs are built
// against — change it deliberately, since every tab folder depends on its shape.
export default function useAppData() {
  const [timeline, setTimeline] = useState(null);
  const [fullGraph, setFullGraph] = useState(null);
  const [events, setEvents] = useState(null);
  const [stocks, setStocks] = useState({});
  const [live, setLive] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [enrichAvail, setEnrichAvail] = useState(false);
  const [currentTs, setCurrentTs] = useState(null);
  const [ai, setAi] = useState({});
  const [error, setError] = useState(null);
  // Bumped after a portfolio mutation. Everything downstream of the user's holdings —
  // value, P/L, the event web, the timeline — is derived, so all of it has to be re-pulled
  // when a stock is added or sold.
  const [portfolioVersion, setPortfolioVersion] = useState(0);

  const refreshPortfolio = useCallback(() => setPortfolioVersion((version) => version + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.timeline(), api.graph(), api.events(), api.stocks(), api.enrichStatus(), api.live(), api.universeQuotes()])
      .then(([tl, g, ev, st, es, lv, qs]) => {
        if (cancelled) return;
        setTimeline(tl);
        setFullGraph(g);
        setEvents(ev);
        setStocks(st);
        setEnrichAvail(es.available);
        setLive(lv);
        setQuotes(qs);
        // Snap the scrubber to the end of the (possibly new) timeline.
        setCurrentTs(tl.end ?? null);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [portfolioVersion]);

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

  const ready = !!(timeline && fullGraph && live);

  return {
    ready,
    error,
    timeline,
    fullGraph,
    events,
    stocks,
    live,
    quotes,
    currentTs,
    setCurrentTs,
    eventsById,
    visibleGraph,
    visibleEvents,
    enrichFor,
    refreshPortfolio,
  };
}
