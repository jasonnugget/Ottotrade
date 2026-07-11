import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let authClient;
let publicClient;

function requireConfig() {
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel environment.'
    );
  }
}

export function getSupabase() {
  requireConfig();
  authClient ??= createClient(url, anonKey);
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
