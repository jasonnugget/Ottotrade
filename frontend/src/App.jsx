import { useEffect, useState } from 'react';
import AppShell from './layout/AppShell.jsx';
import LoginPage from './LoginPage.jsx';
import { getSupabase } from './supabase.js';

// AppShell renders the left sidebar (Home / Portfolio / Explore / Events / Guidance)
// and each tab's content from its own folder under features/. See features/*/ for
// the individual tabs.
export default function App() {
  // 'checking' avoids a flash of the login page while we look for a session that
  // "remember me" left behind from a previous visit.
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setAuthState('out'); // missing config — let LoginPage surface the real error on submit
      return;
    }
    supabase.auth.getSession().then(({ data }) => setAuthState(data.session ? 'in' : 'out'));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? 'in' : 'out');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (authState === 'checking') return <div className="placeholder big">Loading…</div>;
  return authState === 'in'
    ? <AppShell />
    : <LoginPage onLogin={() => setAuthState('in')} />;
}
