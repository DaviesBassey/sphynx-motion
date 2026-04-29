const { supabaseAdmin } = require('../lib/supabase');

/**
 * Verifies the Supabase JWT from the httpOnly cookie.
 * Attaches req.user = { id, email, role } on success.
 * Returns 401 if the token is missing or invalid.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies?.sphynx_admin_session;

  if (!token) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/admin/login');
  }

  // Verify the JWT with Supabase — this hits Supabase's /auth/v1/user
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    res.clearCookie('sphynx_admin_session');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Session expired' });
    }
    return res.redirect('/admin/login');
  }

  // Fetch role from profiles table (single source of truth for roles)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ error: 'Profile not found' });
    }
    return res.redirect('/admin/login');
  }

  req.user = {
    id:           data.user.id,
    email:        data.user.email,
    role:         profile.role,
    display_name: profile.display_name,
  };

  next();
}

module.exports = { requireAuth };
