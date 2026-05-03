const express  = require('express');
const rateLimit = require('express-rate-limit');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth, _invalidateRoleCache } = require('../../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'strict',
  path:     '/',
};

// POST /api/admin/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Quick env check — return a clear 503 instead of a confusing 500
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
    console.error('[admin login] Supabase env vars missing on this server');
    return res.status(503).json({ error: 'Server not configured — check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render env vars.' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('[admin login] auth error:', error.message);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!data?.session) {
      console.error('[admin login] no session returned');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('[admin login] profile fetch error:', profileError.message);
      return res.status(500).json({ error: 'Could not load account profile.' });
    }

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      console.error('[admin login] role denied:', profile?.role);
      return res.status(403).json({ error: 'Access denied. Admin accounts only.' });
    }

    res.cookie('sphynx_admin_session', data.session.access_token, COOKIE_OPTS);

    supabaseAdmin.from('admin_audit_log').insert({
      admin_id:    data.user.id,
      action:      'login',
      target_type: 'session',
      details:     { ip: req.ip, ua: req.headers['user-agent'] },
    }).then(null, () => {});

    res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email, role: profile.role, display_name: profile.display_name },
    });
  } catch (e) {
    console.error('[admin login] unexpected error:', e.message, e.stack);
    res.status(500).json({ error: `DEBUG: ${e.message}` });
  }
});

// POST /api/admin/auth/logout — no requireAuth so cookie is always cleared
router.post('/logout', async (req, res) => {
  const token = req.cookies?.sphynx_admin_session;
  if (token) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        _invalidateRoleCache(user.id);
        supabaseAdmin.from('admin_audit_log').insert({
          admin_id: user.id, action: 'logout', target_type: 'session', details: {},
        }).then(null, () => {});
      }
    } catch {}
  }
  res.clearCookie('sphynx_admin_session', COOKIE_OPTS);
  res.json({ success: true });
});

// GET /api/admin/auth/logout — browser-navigable sign-out link
router.get('/logout', async (req, res) => {
  const token = req.cookies?.sphynx_admin_session;
  if (token) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        _invalidateRoleCache(user.id);
        supabaseAdmin.from('admin_audit_log').insert({
          admin_id: user.id, action: 'logout', target_type: 'session', details: {},
        }).then(null, () => {});
      }
    } catch {}
  }
  res.clearCookie('sphynx_admin_session', COOKIE_OPTS);
  res.redirect('/admin/login');
});

// GET /api/admin/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
