import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REMEMBER_KEY = 'ottotrade.rememberMe';
let authClient;
let publicClient;

function requireConfig() {
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel environment.'
    );
  }
}

// "Remember me" unchecked means the session should not survive closing the browser,
// so it's kept in sessionStorage instead of localStorage. The choice itself is a
// harmless UI preference (not session data), so it's always stashed in localStorage —
// that's what lets a later app-boot session check (see App.jsx) know where to look.
function rememberMePreference() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setRememberMe(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
  } catch {
    // Storage unavailable (e.g. private browsing) — fall back to in-memory default.
  }
  // Force the next getSupabase() call to rebuild the client against the right storage.
  authClient = undefined;
}

export function getSupabase() {
  requireConfig();
  authClient ??= createClient(url, anonKey, {
    auth: {
      storage: rememberMePreference() ? window.localStorage : window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return authClient;
}

// The dashboard's seeded portfolio data is readable to the public key. Keeping
// these queries separate from the signed-in session prevents a bad/stale user JWT
// from blocking the whole dashboard.
export function getPublicSupabase() {
  requireConfig();
  publicClient ??= createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return publicClient;
}
