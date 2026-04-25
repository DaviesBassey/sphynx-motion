require('dotenv').config();

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

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── PUBLIC APP ────────────────────────────────────────────────────────────────
// Serve the static public app (index.html, sw.js, assets/, etc.)
// Everything except /admin/* is public
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

// ── PUBLIC CONFIG (anon key is safe to expose — controlled by RLS) ───────────
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    configured:      CONFIG_OK,
  });
});

// ── PUBLIC CONTENT API (no auth — RLS + status=live filter) ─────────────────
app.use('/api/content', publicRouter);

// ── MUX WEBHOOK (raw body needed for HMAC verification) ──────────────────────
app.use('/api/mux', muxRouter);

// ── ADMIN AUTH API (no auth required — it IS the auth) ───────────────────────
app.use('/api/admin/auth', authRouter);

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
