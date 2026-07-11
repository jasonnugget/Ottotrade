import './guidance.css';

// Placeholder scaffold — nothing built here yet. `live` and `events` are already
// wired in from AppShell so this tab can start reading portfolio/event data
// immediately; extend the props list in layout/AppShell.jsx if more is needed.
export default function GuidanceTab({ live, events }) {
  return (
    <div className="guidance-tab">
      <header className="guidance-header">
        <h1>Guidance</h1>
        <p className="muted tiny">Coming soon</p>
      </header>
      <div className="card guidance-empty">
        <p className="muted">
          This tab is an open scaffold — build out portfolio guidance here. You already
          have <code>live</code> ({live?.positions?.length ?? 0} positions) and{' '}
          <code>events</code> ({events?.length ?? 0} events) as props.
        </p>
      </div>
    </div>
  );
}
