import { useEffect, useRef, useState } from 'react';
import ottoLogo from '../assets/otto-logo.png';
import { getSupabase } from '../supabase.js';
import './Sidebar.css';

// The other icons are plain text glyphs, which take their color from CSS. U+26A1 is an
// EMOJI, so the font renders it in its own yellow and ignores `color` entirely — hence an
// inline SVG that fills with currentColor and tints gray/orange like everything else.
const BoltIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
  </svg>
);

// Left navigation. Purely presentational — add a tab here and drop a folder under
// features/<name>/ with a default-exported <XTab/> component; wire it in AppShell.jsx.
const TABS = [
  { id: 'home', label: 'Home', icon: '◕' },
  { id: 'portfolio', label: 'Portfolio', icon: '◆' },
  { id: 'explore', label: 'Explore', icon: '⚲' },
  { id: 'events', label: 'Events', icon: <BoltIcon /> },
  { id: 'analysis', label: 'Analysis', icon: '✦' },
];

export default function Sidebar({ active, onSelect, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef(null);

  // Click outside / Escape closes the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (!profileRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // App.jsx listens for the auth state change and redirects to /login — no navigate here.
  async function signOut() {
    setSigningOut(true);
    try {
      await getSupabase().auth.signOut();
    } catch {
      setSigningOut(false);
    }
  }

  const email = user?.email || '';
  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={ottoLogo} alt="" />
        <span>OttoTrade</span>
      </div>

      <div className="sidebar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            <span className="sidebar-tab-icon">{tab.icon}</span>
            <span className="sidebar-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-profile" ref={profileRef}>
        {menuOpen && (
          <div className="profile-menu" role="menu">
            <div className="profile-menu-email">{email || 'Signed in'}</div>
            <button className="profile-menu-item" role="menuitem" onClick={signOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
        <button
          className="profile-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="profile-avatar">{initial}</span>
          <span className="profile-email">{email || 'Account'}</span>
          <span className="profile-caret muted">{menuOpen ? '▾' : '▴'}</span>
        </button>
      </div>
    </nav>
  );
}
