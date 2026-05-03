const jwt            = require('jsonwebtoken');
const { supabaseAdmin } = require('../lib/supabase');

const _roleCache = new Map();
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

  // Primary: verify with COOKIE_SECRET (our own signed JWT — no network call)
  const cookieSecret = process.env.COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (cookieSecret) {
    try {
      const payload = jwt.verify(token, cookieSecret);
      req.user = {
        id:           payload.sub,
        email:        payload.email,
        role:         payload.role,
        display_name: payload.display_name,
      };
      return next();
    } catch {
      // Token invalid or signed by old secret — fall through to Supabase verify
    }
  }

  // Fallback: verify Supabase JWT directly
  const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
  if (supabaseSecret) {
    try {
      const payload = jwt.verify(token, supabaseSecret);
      const userId  = payload.sub;
      const cached  = _roleCache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        req.user = { id: userId, email: payload.email, role: cached.role, display_name: cached.display_name };
        return next();
      }
      const { data: profile, error } = await supabaseAdmin
        .from('profiles').select('role, display_name').eq('id', userId).single();
      if (error || !profile) {
        res.clearCookie('sphynx_admin_session', { path: '/' });
        if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Profile not found' });
        return res.redirect('/admin/login');
      }
      _roleCache.set(userId, { role: profile.role, display_name: profile.display_name, expiry: Date.now() + CACHE_TTL });
      req.user = { id: userId, email: payload.email, role: profile.role, display_name: profile.display_name };
      return next();
    } catch {
      res.clearCookie('sphynx_admin_session', { path: '/' });
      if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Session expired' });
      return res.redirect('/admin/login');
    }
  }

  // Last resort: remote verify via Supabase auth API
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw new Error('invalid');
    const userId = data.user.id;
    const cached = _roleCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      req.user = { id: userId, email: data.user.email, role: cached.role, display_name: cached.display_name };
      return next();
    }
    const { data: profile, error: pe } = await supabaseAdmin
      .from('profiles').select('role, display_name').eq('id', userId).single();
    if (pe || !profile) {
      res.clearCookie('sphynx_admin_session', { path: '/' });
      if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Profile not found' });
      return res.redirect('/admin/login');
    }
    _roleCache.set(userId, { role: profile.role, display_name: profile.display_name, expiry: Date.now() + CACHE_TTL });
    req.user = { id: userId, email: data.user.email, role: profile.role, display_name: profile.display_name };
    return next();
  } catch {
    res.clearCookie('sphynx_admin_session', { path: '/' });
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Session expired' });
    return res.redirect('/admin/login');
  }
}

module.exports = { requireAuth, _invalidateRoleCache };
