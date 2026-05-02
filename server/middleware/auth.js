const jwt            = require('jsonwebtoken');
const { supabaseAdmin } = require('../lib/supabase');

// In-memory role cache — avoids a DB round-trip on every request.
// Entries expire after 5 minutes; invalidated immediately on logout.
const _roleCache = new Map(); // userId → { role, display_name, expiry }
const CACHE_TTL  = 5 * 60 * 1000;

function _invalidateRoleCache(userId) {
  _roleCache.delete(userId);
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.sphynx_admin_session;

  if (!token) {
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
    return res.redirect('/admin/login');
  }

  // Verify JWT — locally if SUPABASE_JWT_SECRET is set (fast), else remote (slow fallback)
  let userId, userEmail;
  if (process.env.SUPABASE_JWT_SECRET) {
    let payload;
    try {
      payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    } catch {
      res.clearCookie('sphynx_admin_session');
      if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Session expired' });
      return res.redirect('/admin/login');
    }
    userId    = payload.sub;
    userEmail = payload.email;
  } else {
    // Fallback: remote verify (one extra network call — add SUPABASE_JWT_SECRET to remove this)
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      res.clearCookie('sphynx_admin_session');
      if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Session expired' });
      return res.redirect('/admin/login');
    }
    userId    = data.user.id;
    userEmail = data.user.email;
  }

  // Check cache first
  const cached = _roleCache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    req.user = { id: userId, email: userEmail, role: cached.role, display_name: cached.display_name };
    return next();
  }

  // Cache miss — one DB fetch then cache for 5 min
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Profile not found' });
    return res.redirect('/admin/login');
  }

  _roleCache.set(userId, { role: profile.role, display_name: profile.display_name, expiry: Date.now() + CACHE_TTL });

  req.user = { id: userId, email: userEmail, role: profile.role, display_name: profile.display_name };
  next();
}

module.exports = { requireAuth, _invalidateRoleCache };
