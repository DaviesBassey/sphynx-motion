require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express      = require('express');
const path         = require('path');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./middleware/auth');
const { requireRole } = require('./middleware/roles');

const authRouter       = require('./routes/api/auth');
const publicRouter     = require('./routes/api/public');
const contentRouter    = require('./routes/api/content');
const usersRouter      = require('./routes/api/users');
const moderationRouter = require('./routes/api/moderation');
const uploadsRouter    = require('./routes/api/uploads');
const revenueRouter    = require('./routes/api/revenue');
const tokensRouter     = require('./routes/api/tokens');
const analyticsRouter  = require('./routes/api/analytics');
const settingsRouter   = require('./routes/api/settings');
const languagesRouter  = require('./routes/api/languages');
const muxRouter        = require('./routes/api/mux');
const paymentsRouter   = require('./routes/api/payments');
const pushRouter       = require('./routes/api/push');
const engageRouter     = require('./routes/api/engagement');
const creatorsRouter   = require('./routes/api/creators');
const legalRouter      = require('./routes/legal');

// ── STARTUP CONFIG CHECK ──────────────────────────────────────────────────────
const PLACEHOLDERS = ['YOUR_PROJECT_ID', 'your-anon-key-here', 'your-service-role-key-here', 'CHANGE_THIS'];
function isPlaceholder(v) { return !v || PLACEHOLDERS.some(p => v.includes(p)); }

const CONFIG_OK = !isPlaceholder(process.env.SUPABASE_URL)
               && !isPlaceholder(process.env.SUPABASE_ANON_KEY)
               && !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!CONFIG_OK) {
  console.warn('\n  ⚠️  Supabase keys not set in server/.env');
  console.warn('  Open server/.env and replace the placeholder values.');
  console.warn('  See START.md for the full setup guide.\n');
}

const app  = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

// Trust the first hop (Cloudflare / any reverse proxy) so that
// X-Forwarded-For is used for real-IP detection and rate-limiting.
app.set('trust proxy', 1);

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── PUBLIC APP ────────────────────────────────────────────────────────────────
// index.html and sw.js must never be served stale — always revalidate
app.get(['/', '/index.html'], (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.get('/sw.js', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});
app.use(express.static(ROOT, {
  index: 'index.html',
  dotfiles: 'ignore',
}));

// ── HEALTH CHECK (public — used by dashboard to show connection status) ──────
app.get('/api/admin/health', async (req, res) => {
  if (!CONFIG_OK) {
    return res.status(503).json({
      ok: false,
      supabase: false,
      config: false,
      error: 'Supabase keys not configured in server/.env',
      missing: [
        !process.env.SUPABASE_URL            || isPlaceholder(process.env.SUPABASE_URL)            ? 'SUPABASE_URL' : null,
        !process.env.SUPABASE_ANON_KEY       || isPlaceholder(process.env.SUPABASE_ANON_KEY)       ? 'SUPABASE_ANON_KEY' : null,
        !process.env.SUPABASE_SERVICE_ROLE_KEY || isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean),
    });
  }

  // Ping Supabase with a lightweight query
  try {
    const { supabaseAdmin } = require('./lib/supabase');
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error && error.code === '42P01') {
      // Table doesn't exist → connected but migrations not run
      return res.json({ ok: true, supabase: true, config: true, migrations: false,
        error: 'Run supabase/migrations/001_schema.sql and 002_rls.sql in the Supabase SQL editor' });
    }
    if (error) throw error;
    return res.json({ ok: true, supabase: true, config: true, migrations: true });
  } catch (e) {
    return res.status(503).json({ ok: false, supabase: false, config: true, error: e.message });
  }
});

// ── PUBLIC HEALTH ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── PUBLIC CONFIG (anon key is safe to expose — controlled by RLS) ───────────
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    configured:      CONFIG_OK,
  });
});

// ── PUBLIC LANGUAGES + TRANSLATIONS ──────────────────────────────────────────
app.get('/api/languages', async (req, res) => {
  try {
    const { supabaseAdmin } = require('./lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('languages')
      .select('code, name, native_name, is_rtl, is_default')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    res.json({ languages: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/translations/:lang', async (req, res) => {
  try {
    const { supabaseAdmin } = require('./lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('ui_translations')
      .select('namespace, key, value')
      .eq('language_code', req.params.lang);
    if (error) throw error;
    const out = {};
    (data || []).forEach(r => {
      if (!out[r.namespace]) out[r.namespace] = {};
      out[r.namespace][r.key] = r.value;
    });
    res.json({ translations: out, lang: req.params.lang });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUBLIC CONTENT API (no auth — RLS + status=live filter) ─────────────────
app.use('/api/content', publicRouter);

// ── ENGAGEMENT (watchlist, progress, votes, rewards — optional auth) ──────────
app.use('/api/engage', engageRouter);

// ── CREATOR ONBOARDING (public apply + admin manage) ─────────────────────────
app.use('/api/creators', requireAuth, creatorsRouter);

// ── PAYMENTS (Stripe webhook needs raw body — registered before json parser) ──
app.use('/api/payments', paymentsRouter);

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
app.use('/api/push', pushRouter);

// ── MUX WEBHOOK (raw body needed for HMAC verification) ──────────────────────
app.use('/api/mux', muxRouter);

// ── ADMIN AUTH API (no auth required — it IS the auth) ───────────────────────
app.use('/api/admin/auth', authRouter);

// ── /api/admin/me — convenience alias for the dashboard ──────────────────────
app.get('/api/admin/me', requireAuth, (req, res) => res.json({ user: req.user }));

// ── ADMIN PAGE ROUTES (server-side auth + role check) ────────────────────────
// GET /admin/ → redirect to /admin/login
app.get('/admin', (req, res) => res.redirect('/admin/login'));

// GET /admin/login — serve login page (no auth needed)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

// GET /admin/dashboard — requires auth + admin role
app.get('/admin/dashboard', requireAuth, requireRole('admin'), (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'dashboard.html'));
});

// Catch /admin/* paths — serve login if not authed, dashboard if authed
app.get('/admin/*', requireAuth, requireRole('admin'), (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'dashboard.html'));
});

// ── ADMIN API ROUTES (all require auth + min admin role) ─────────────────────
app.use('/api/admin/content',    requireAuth, requireRole('admin'), contentRouter);
app.use('/api/admin/users',      requireAuth, requireRole('admin'), usersRouter);
app.use('/api/admin/moderation', requireAuth, requireRole('admin'), moderationRouter);
app.use('/api/admin/uploads',    requireAuth, requireRole('admin'), uploadsRouter);
app.use('/api/admin/tokens',     requireAuth, requireRole('admin'), tokensRouter);
app.use('/api/admin/analytics',  requireAuth, requireRole('admin'), analyticsRouter);
// Revenue and settings: superadmin only (enforced inside each router too)
app.use('/api/admin/revenue',    requireAuth, requireRole('superadmin'), revenueRouter);
app.use('/api/admin/settings',   requireAuth, requireRole('superadmin'), settingsRouter);
app.use('/api/admin/languages',  requireAuth, requireRole('admin'), languagesRouter);
app.use('/api/admin/video',      requireAuth, requireRole('admin'), muxRouter);
app.use('/api/admin/push',       requireAuth, requireRole('admin'), pushRouter);
app.use('/api/admin/creators',   requireAuth, requireRole('admin'), creatorsRouter);

// ── USER SELF-SERVICE ACCOUNT DELETION ───────────────────────────────────────
// DELETE /api/account  — requires valid user Bearer token; deletes own account.
// Apple App Store compliance: must exist for any app with account creation.
app.delete('/api/account', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { supabaseAdmin } = require('./lib/supabase');
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (delErr) return res.status(500).json({ error: 'Account deletion failed. Please contact support.' });

  res.json({ success: true, message: 'Account deleted' });
});

// ── LEGAL / STORE PAGES (public URLs for App Store & Google Play review) ─────
app.use('/', legalRouter);

// ── SPA FALLBACK ──────────────────────────────────────────────────────────────
// Any unmatched route → serve the public app
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║  SPHYNX MOTION server running             ║
  ║  Public app : http://localhost:${PORT}       ║
  ║  Admin login: http://localhost:${PORT}/admin/login ║
  ╚═══════════════════════════════════════════╝
  `);
});
