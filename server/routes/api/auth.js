const express = require('express');
const rateLimit = require('express-rate-limit');
const { supabaseAdmin, supabaseAnon } = require('../../lib/supabase');
const { requireAuth, _invalidateRoleCache } = require('../../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// POST /api/admin/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Use admin client — service role key works for signInWithPassword and avoids
    // the anon key placeholder path that causes 500s when SUPABASE_ANON_KEY is unset.
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('[admin login] auth error:', error.message, error.status);
      return res.status(401).json({ error: 'Invalid credentials' });
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

    res.cookie('sphynx_admin_session', data.session.access_token, {
      httpOnly: true,
      secure:   req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
      maxAge:   8 * 60 * 60 * 1000,
    });

    supabaseAdmin.from('admin_audit_log').insert({
      admin_id:    data.user.id,
      action:      'login',
      target_type: 'session',
      details:     { ip: req.ip, ua: req.headers['user-agent'] },
    }).catch(() => {});

    res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email, role: profile.role, display_name: profile.display_name },
    });
  } catch (e) {
    console.error('[admin login] unexpected error:', e.message, e.stack);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/admin/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  _invalidateRoleCache(req.user.id);
  supabaseAdmin.from('admin_audit_log').insert({
    admin_id:    req.user.id,
    action:      'logout',
    target_type: 'session',
    details:     {},
  }).catch(() => {});

  res.clearCookie('sphynx_admin_session');
  res.json({ success: true });
});

// GET /api/admin/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
