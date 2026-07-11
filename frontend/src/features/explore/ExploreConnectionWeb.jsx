import { useEffect, useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { dirColor, EVENT_COLOR, TIER, stockPerfColor, tierColor } from '../../shared/theme.js';

const formatEventDay = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
};

// Explore owns this version so event bubbles can show their date and market direction.
export default function ExploreConnectionWeb({ graph, selectedId, onSelect, width, height }) {
  const fgRef = useRef();
  const cache = useRef(new Map());
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
    if (!graphApi || !data.nodes.length) return;
    graphApi.d3Force('charge')?.strength(-140);
    const timer = setTimeout(() => graphApi.zoomToFit(500, 24), 400);
    return () => clearTimeout(timer);
  }, [data]);

  const radius = (node) => node.type === 'stock'
    ? Math.min(22, 7 + (node.impactMagnitude || 0) * 0.9)
    : 24;

  const nodeCanvasObject = (node, ctx, scale) => {
    const r = radius(node);
    const selected = node.id === selectedId;
    if (node.type === 'stock') {
      const color = stockPerfColor(node.dayChangePct);
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 / scale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#0a0f1e';
      ctx.fill();
      ctx.lineWidth = 2.25 / scale;
      ctx.strokeStyle = selected ? '#fff' : color;
      ctx.stroke();
      ctx.font = `700 ${11 / scale}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(node.label, node.x, node.y);
      ctx.restore();
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
    ctx.shadowBlur = 12 / scale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = EVENT_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = EVENT_COLOR;
    ctx.stroke();
    ctx.font = `700 ${8 / scale}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arrow = node.direction === 'up' ? '↑' : node.direction === 'down' ? '↓' : '→';
    ctx.fillStyle = dirColor(node.direction);
    ctx.fillText(`${node.eventDay} ${arrow}`, node.x, node.y);
    ctx.restore();
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
    <div className="web-backdrop" style={{ width, height }}>
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={120}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={(link) => selectedId && (link.source.id === selectedId || link.target.id === selectedId) ? 4 : 0}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link) => link.kind === 'event-event' ? TIER.related.color : tierColor(link.tier)}
        onNodeClick={onSelect}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  );
}
