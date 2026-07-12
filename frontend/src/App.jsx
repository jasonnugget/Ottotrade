import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import LoginPage from './LoginPage.jsx';
import { getSupabase } from './supabase.js';
import { resetPortfolioCache } from './api.js';

// Routes:
//   /login                  — sign in / sign up
//   /home /portfolio /events /analysis
//   /explore                — stock picker
//   /explore/:symbol        — one stock's chart + event web
// Everything except /login requires a session; signing out returns you to /login.
export default function App() {
  // 'checking' avoids a flash of the login page while we look for a session that
  // "remember me" left behind from a previous visit.
  const [authState, setAuthState] = useState('checking');
  const [user, setUser] = useState(null);
  // Supabase fires SIGNED_IN the moment credentials are accepted, which would yank us to
  // /home instantly and cut off Otto's ink transition. While the login page is playing that
  // animation we hold position and let LoginPage call onLogin when it's finished.
  const [departing, setDeparting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setAuthState('out'); // missing config — let LoginPage surface the real error on submit
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthState(data.session ? 'in' : 'out');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Drop the previous user's cached holdings before the next user's data loads.
      resetPortfolioCache();
      setUser(session?.user ?? null);
      setAuthState(session ? 'in' : 'out');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Signing out anywhere in the app drops you back on /login.
  useEffect(() => {
    if (authState === 'out') {
      setDeparting(false);
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    }
  }, [authState, location.pathname, navigate]);

  if (authState === 'checking') return <div className="placeholder big">Loading…</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authState === 'in' && !departing
            ? <Navigate to="/home" replace />
            : (
              <LoginPage
                onDepart={() => setDeparting(true)}
                onLogin={() => {
                  setDeparting(false);
                  navigate('/home', { replace: true });
                }}
              />
            )
        }
      />
      <Route
        path="/*"
        element={
          authState === 'in'
            ? <AppShell user={user} />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}
