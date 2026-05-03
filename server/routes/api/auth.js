const https    = require('https');
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

// Calls Supabase /auth/v1/token using Node's built-in https — no fetch/axios needed.
function supabaseSignIn(supabaseUrl, apiKey, email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password });
    const parsed = new URL(`${supabaseUrl}/auth/v1/token?grant_type=password`);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey':         apiKey,
        'Authorization':  `Bearer ${apiKey}`,
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// POST /api/admin/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !apiKey || supabaseUrl.includes('placeholder')) {
    console.error('[admin login] Supabase env vars not configured');
    return res.status(503).json({ error: 'Server not configured. Contact support.' });
  }

  try {
    const { status, data: authData } = await supabaseSignIn(supabaseUrl, apiKey, email, password);

    if (status !== 200 || !authData.access_token) {
      console.error('[admin login] auth rejected:', status, authData.error_description || authData.error || authData.msg);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(authData.access_token);
    if (userErr || !user) {
      console.error('[admin login] getUser error:', userErr?.message);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[admin login] profile fetch error:', profileError.message);
      return res.status(500).json({ error: 'Could not load account profile.' });
    }

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      console.error('[admin login] role denied:', profile?.role);
      return res.status(403).json({ error: 'Access denied. Admin accounts only.' });
    }

    res.cookie('sphynx_admin_session', authData.access_token, {
      httpOnly: true,
      secure:   req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
      maxAge:   8 * 60 * 60 * 1000,
    });

    supabaseAdmin.from('admin_audit_log').insert({
      admin_id:    user.id,
      action:      'login',
      target_type: 'session',
      details:     { ip: req.ip, ua: req.headers['user-agent'] },
    }).catch(() => {});

    res.json({
      success: true,
      user: { id: user.id, email: user.email, role: profile.role, display_name: profile.display_name },
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
