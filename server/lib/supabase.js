const { createClient } = require('@supabase/supabase-js');

function isValidUrl(v) {
  try { new URL(v); return true; } catch { return false; }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const opts = { auth: { autoRefreshToken: false, persistSession: false } };

// Fall back to a no-op placeholder when env vars aren't set yet so the server
// can boot and serve /api/health even before Supabase is configured.
const supabaseAdmin = isValidUrl(url) && serviceKey
  ? createClient(url, serviceKey, opts)
  : createClient('https://placeholder.supabase.co', 'placeholder', opts);

const supabaseAnon = isValidUrl(url) && anonKey
  ? createClient(url, anonKey, opts)
  : createClient('https://placeholder.supabase.co', 'placeholder', opts);

module.exports = { supabaseAdmin, supabaseAnon };
