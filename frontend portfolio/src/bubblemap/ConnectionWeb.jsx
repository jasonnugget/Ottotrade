import { useRef, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { TIER, CATEGORY, tierColor, EPICENTER_COLOR } from './theme.js';

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
    const links = graph.edges.map((e) => ({ ...e }));
    return { nodes, links };
  }, [graph]);

  const fitted = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !data.nodes.length) return;
    fg.d3Force('charge')?.strength(-140);
    // Fit once on first populated render; don't re-zoom on every scrubber step.
    if (!fitted.current) {
      fitted.current = true;
      const t = setTimeout(() => fg.zoomToFit(500, 60), 400);
      return () => clearTimeout(t);
    }
  }, [data]);

  const radius = (node) =>
    node.type === 'stock' ? 8 : 3.5 + Math.min(9, (node.magnitude || 0) * 1.3);

  const nodeCanvasObject = (node, ctx, scale) => {
    const r = radius(node);
    const isSel = node.id === selectedId;

    if (node.type === 'stock') {
      // Pulsing neon ring: the stock is the shock epicenter, same visual role in every view.
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 500);
      ctx.save();
      ctx.shadowColor = EPICENTER_COLOR;
      ctx.shadowBlur = (14 + 8 * pulse) / scale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#0a0f1e';
      ctx.fill();
      ctx.lineWidth = 2.25 / scale;
      ctx.strokeStyle = isSel ? '#ffffff' : EPICENTER_COLOR;
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

    // event node — soft neon glow in its confidence-tier color
    const col = tierColor(node.tier);
    if (isSel) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = (isSel ? 14 : 8) / scale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = CATEGORY[node.category] || '#94a3b8';
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
      />
    </div>
  );
}
