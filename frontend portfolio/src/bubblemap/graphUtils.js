import { useEffect, useRef, useState } from 'react';

// Subgraph for one stock: the stock node + events that touch it (+ their similarity links).
export function subgraphForStock(graph, symbol) {
  const eventEdges = graph.edges.filter((e) => e.kind === 'event-stock' && e.target === symbol);
  const eventIds = new Set(eventEdges.map((e) => e.source));
  const nodes = graph.nodes.filter((n) => n.id === symbol || eventIds.has(n.id));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => {
    if (e.kind === 'event-stock') return e.target === symbol && ids.has(e.source);
    // event-event links among this stock's events
    return ids.has(e.source) && ids.has(e.target);
  });
  return { nodes, edges };
}

// Measure a stage element for the force-graph canvas.
export function useStageSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(300, r.width), h: Math.max(320, r.height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
