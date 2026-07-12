import ottoLogo from '../assets/otto-logo.png';
import './Sidebar.css';

// Left navigation. Purely presentational — add a tab here and drop a folder under
// features/<name>/ with a default-exported <XTab/> component; wire it in AppShell.jsx.
const TABS = [
  { id: 'home', label: 'Home', icon: '◕' },
  { id: 'portfolio', label: 'Portfolio', icon: '◆' },
  { id: 'explore', label: 'Explore', icon: '⚲' },
  { id: 'events', label: 'Events', icon: '⚡' },
  { id: 'analysis', label: 'Analysis', icon: '✦' },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={ottoLogo} alt="" />
        <span>Ottotrade</span>
      </div>
      <div className="sidebar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sidebar-tab ${active === t.id ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <span className="sidebar-tab-icon">{t.icon}</span>
            <span className="sidebar-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
