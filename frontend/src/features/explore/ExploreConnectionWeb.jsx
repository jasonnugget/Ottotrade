import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { dirColor, EVENT_COLOR, TIER, stockPerfColor, tierColor } from '../../shared/theme.js';

// Bubble sizes mirror Home's event web: one small uniform dot per event, and a stock
// bubble that grows with how much it's been shaken up.
const STOCK_MIN_RADIUS = 7;
const STOCK_MAX_RADIUS = 22;
const EVENT_RADIUS = 6;

// A stock's web only has a handful of nodes, so zoomToFit alone would scale them up
// until the bubbles swallow the canvas. Cap how far it's allowed to zoom in.
const MAX_ZOOM = 2.2;

const formatEventDay = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
};

// Explore owns this version so event bubbles can show their date and market direction.
// It measures its own container: the Explore view mounts this only after you switch to
// the bubble-map tab, so a size measured by the parent on first mount would be stale.
export default function ExploreConnectionWeb({ graph, selectedId, onSelect }) {
  const fgRef = useRef();
  const cache = useRef(new Map());
  const [size, setSize] = useState({ w: 0, h: 0 });

  const stageRef = useCallback((node) => {
    if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const directionByEvent = new Map(
      graph.edges
        .filter((edge) => edge.kind === 'event-stock')
        .map((edge) => [edge.source, edge.direction])
    );
    const nodes = graph.nodes.map((node) => {
      const cached = cache.current.get(node.id);
      const item = Object.assign(cached || {}, node, {
        eventDay: node.type === 'event' ? formatEventDay(node.date) : null,
        direction: directionByEvent.get(node.id),
      });
      cache.current.set(node.id, item);
      return item;
    });
    return { nodes, links: graph.edges.map((edge) => ({ ...edge })) };
  }, [graph]);

  useEffect(() => {
    const graphApi = fgRef.current;
    if (!graphApi || !data.nodes.length || !size.w) return;
    graphApi.d3Force('charge')?.strength(-140);
    const timer = setTimeout(() => {
      graphApi.zoomToFit(500, 60);
      // zoomToFit animates; clamp once it has settled.
      setTimeout(() => {
        if (graphApi.zoom() > MAX_ZOOM) graphApi.zoom(MAX_ZOOM, 300);
      }, 550);
    }, 400);
    return () => clearTimeout(timer);
  }, [data, size.w, size.h]);

  const radius = (node) => (node.type === 'stock'
    ? Math.min(STOCK_MAX_RADIUS, STOCK_MIN_RADIUS + (node.impactMagnitude || 0) * 0.9)
    : EVENT_RADIUS);

  const nodeCanvasObject = (node, ctx, scale) => {
    const r = radius(node);
    const selected = node.id === selectedId;

    if (node.type === 'stock') {
      const color = stockPerfColor(node.dayChangePct);
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 500);
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = (14 + 8 * pulse) / scale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#050506';
      ctx.fill();
      ctx.lineWidth = 2.25 / scale;
      ctx.strokeStyle = selected ? '#fff' : color;
      ctx.stroke();
      ctx.restore();

      ctx.font = `700 ${11 / scale}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(node.label, node.x, node.y);
      return;
    }

    if (selected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = EVENT_COLOR;
    ctx.shadowBlur = (selected ? 14 : 8) / scale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = EVENT_COLOR;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = EVENT_COLOR;
    ctx.stroke();
    ctx.restore();

    // Date + which way the stock moved, captioned under the bubble so it stays legible
    // instead of being crammed inside it.
    ctx.font = `600 ${9 / scale}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const arrow = node.direction === 'up' ? '↑' : node.direction === 'down' ? '↓' : '→';
    ctx.fillStyle = dirColor(node.direction);
    ctx.fillText(`${node.eventDay} ${arrow}`, node.x, node.y + r + 3 / scale);
  };

  const nodePointerAreaPaint = (node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius(node) + 4, 0, 2 * Math.PI);
    ctx.fill();
  };

  const linkCanvasObject = (link, ctx, scale) => {
    const source = link.source;
    const target = link.target;
    if (!source || source.x == null || target.x == null) return;
    const tier = link.kind === 'event-event' ? TIER.related : (TIER[link.tier] || TIER.unrelated);
    const selectedLink = selectedId && (source.id === selectedId || target.id === selectedId);
    ctx.save();
    ctx.globalAlpha = selectedId ? (selectedLink ? 1 : 0.08) : 0.65;
    if (selectedLink) {
      ctx.shadowColor = tier.color;
      ctx.shadowBlur = 6 / scale;
    }
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = (link.kind === 'event-event' ? 1 : link.tier === 'direct' ? 1.6 : 1) / scale;
    ctx.setLineDash(tier.dash.map((dash) => dash / scale));
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.restore();
  };

  return (
    <div className="explore-web-backdrop" ref={stageRef}>
      {size.w > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          nodeLabel={(node) => (node.type === 'stock' ? `${node.name} (${node.sector})` : node.label)}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkCanvasObject={linkCanvasObject}
          linkDirectionalParticles={(link) => (selectedId && (link.source.id === selectedId || link.target.id === selectedId) ? 4 : 0)}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={(link) => (link.kind === 'event-event' ? TIER.related.color : tierColor(link.tier))}
          onNodeClick={(node) => node.type === 'event' && onSelect({ id: node.id, type: 'event' })}
          onBackgroundClick={() => onSelect(null)}
        />
      )}
    </div>
  );
}
