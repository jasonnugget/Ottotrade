// Confidence-tier + category visual language for the bubble map.

export const TIER = {
  direct: { color: '#22c55e', dash: [], label: 'Direct', desc: 'Mechanical / business causation' },
  indirect: { color: '#f59e0b', dash: [5, 4], label: 'Indirect', desc: 'Macro / sentiment chain' },
  unrelated: { color: '#64748b', dash: [2, 4], label: 'Unrelated', desc: 'Same-day coincidence' },
  related: { color: '#38bdf8', dash: [6, 4], label: 'Similar event', desc: '“What could happen next”' },
};

export const CATEGORY = {
  geopolitical_conflict: '#ef4444',
  supply_chain: '#f97316',
  regulatory: '#a855f7',
  natural_disaster: '#eab308',
  macro_policy: '#3b82f6',
  competitor_news: '#ec4899',
  company_specific: '#14b8a6',
  demand_shift: '#8b5cf6',
  earnings: '#06b6d4',
};

// The stock node itself is the "shock epicenter" — always this color, independent of tier.
export const EPICENTER_COLOR = '#ff2d78';

export const categoryLabel = (c) =>
  (c || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export const tierColor = (t) => (TIER[t] || TIER.unrelated).color;
export const dirColor = (d) => (d === 'up' ? '#22c55e' : d === 'down' ? '#ef4444' : '#94a3b8');
