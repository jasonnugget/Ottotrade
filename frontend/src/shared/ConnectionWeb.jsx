import { useRef, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceX, forceY, forceCollide } from 'd3-force-3d';
import { TIER, tierColor, EVENT_COLOR, stockPerfColor } from './theme.js';

// The "web of connections": event nodes + stock nodes, edges tiered by confidence.
export default function ConnectionWeb({ graph, selectedId, onSelect, width, height }) {
  const fgRef = useRef();
  const cache = useRef(new Map()); // preserve node positions across timeline steps

  const data = useMemo(() => {
    const nodes = graph.nodes.map((n) => {
      const c = cache.current.get(n.id);
      if (c) return Object.assign(c, n);
      const obj = { ...n };
      cache.current.set(n.id, obj);
      return obj;
    });
    // Drop "unrelated" event-stock links entirely — same-day coincidences aren't a
    // real causal connection, so they're just clutter on the web.
    const links = graph.edges.filter((e) => e.tier !== 'unrelated').map((e) => ({ ...e }));
    return { nodes, links };
  }, [graph]);

  const fitted = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !data.nodes.length) return;
    fitted.current = false; // new graph data means a fresh layout to settle and fit
    fg.d3Force('charge')?.strength(-160);
    // A weak pull toward center so nodes with no remaining links (e.g. a stock whose
    // only event connections were "unrelated" and got filtered out) don't drift off
    // into empty space under charge repulsion alone — barely affects linked nodes,
    // which are already held in place by much stronger link forces.
    fg.d3Force('centerX', forceX(0).strength(0.02));
    fg.d3Force('centerY', forceY(0).strength(0.02));
    // Hard floor on how close any two bubbles' centers can get, sized to their own
    // radius plus a little breathing room — this is what actually guarantees no
    // overlap, since charge repulsion alone doesn't stop linked nodes from settling
    // close together.
    fg.d3Force('collide', forceCollide((node) => radius(node) + 8));
  }, [data]);

  // Wait for the layout to actually settle before fitting the view, so the first
  // thing a user sees already has every bubble visible and non-overlapping —
  // fitting on a timer risked catching the simulation mid-motion.
  const handleEngineStop = () => {
    if (fitted.current) return;
    fitted.current = true;
    fgRef.current?.zoomToFit(400, 40);
  };

  // Stock bubbles scale with how much that stock has been affected (total impact
  // magnitude from touching events); event bubbles are all the same fixed size now.
  const STOCK_MIN_RADIUS = 7;
  const STOCK_MAX_RADIUS = 22;
  const EVENT_RADIUS = 6;

  const radius = (node) =>
    node.type === 'stock'
      ? Math.min(STOCK_MAX_RADIUS, STOCK_MIN_RADIUS + (node.impactMagnitude || 0) * 0.9)
      : EVENT_RADIUS;

  const nodeCanvasObject = (node, ctx, scale) => {
    const r = radius(node);
    const isSel = node.id === selectedId;
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 500);

    if (node.type === 'stock') {
      // Pulsing neon ring, colored by day performance: green for up, red for down.
      const col = stockPerfColor(node.dayChangePct);
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = (14 + 8 * pulse) / scale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#050506';
      ctx.fill();
      ctx.lineWidth = 2.25 / scale;
      ctx.strokeStyle = isSel ? '#ffffff' : col;
      ctx.stroke();
      ctx.restore();

      const fs = 11 / scale;
      ctx.font = `700 ${fs}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(node.label, node.x, node.y);
      return;
    }

    // event node — same pulsing glow treatment as the stock bubbles, kept orange
    if (isSel) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = EVENT_COLOR;
    ctx.shadowBlur = ((isSel ? 18 : 14) + 8 * pulse) / scale;
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
  };

  const nodePointerAreaPaint = (node, color, ctx) => {
    ctx.fillStyle = color;
    const r = radius(node) + 2;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  const linkCanvasObject = (link, ctx, scale) => {
    const s = link.source;
    const t = link.target;
    if (!s || s.x == null || t.x == null) return;
    let color;
    let dash;
    let w;
    if (link.kind === 'event-event') {
      color = TIER.related.color;
      dash = TIER.related.dash;
      w = 0.6 + (link.weight || 0.5);
    } else {
      const tier = TIER[link.tier] || TIER.unrelated;
      color = tier.color;
      dash = tier.dash;
      w = link.tier === 'direct' ? 1.6 : link.tier === 'indirect' ? 1.1 : 0.8;
    }
    const touches = selectedId && (s.id === selectedId || t.id === selectedId);
    ctx.save();
    ctx.globalAlpha = selectedId ? (touches ? 1 : 0.08) : 0.65;
    if (touches) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 / scale;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w / scale;
    ctx.setLineDash(dash.map((d) => d / scale));
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
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
        nodeLabel={(n) => (n.type === 'stock' ? `${n.name} (${n.sector})` : n.label)}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={(l) =>
          selectedId && (l.source.id === selectedId || l.target.id === selectedId) ? 4 : 0
        }
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(l) =>
          l.kind === 'event-event' ? TIER.related.color : tierColor(l.tier)
        }
        onNodeClick={(n) => onSelect(n)}
        onBackgroundClick={() => onSelect(null)}
        onEngineStop={handleEngineStop}
      />
    </div>
  );
}
