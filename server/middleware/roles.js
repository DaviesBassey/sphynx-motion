const ROLE_LEVELS = { user: 0, creator: 1, admin: 2, superadmin: 3 };

/**
 * requireRole('admin') — passes if req.user.role is 'admin' OR 'superadmin'.
 * requireRole('superadmin') — passes ONLY for 'superadmin'.
 */
function requireRole(minimumRole) {
  return (req, res, next) => {
    const userLevel = ROLE_LEVELS[req.user?.role] ?? -1;
    const requiredLevel = ROLE_LEVELS[minimumRole] ?? 99;

    if (userLevel >= requiredLevel) return next();

    // User is logged in but doesn't have the right role
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: minimumRole,
        actual: req.user?.role ?? 'none',
      });
    }

    // For page requests: non-admins go back to the public app
    if (userLevel < ROLE_LEVELS['admin']) {
      return res.redirect('/');
    }

    // Admin trying to access superadmin page
    return res.status(403).send(`
      <!DOCTYPE html><html><head><title>Access Denied</title>
      <style>body{background:#08080A;color:#F0F0F2;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}</style>
      </head><body>
      <div>
        <div style="font-size:48px;margin-bottom:16px">🔒</div>
        <h2>Superadmin required</h2>
        <p style="color:#9090A0;margin:8px 0 24px">This section requires superadmin privileges.</p>
        <a href="/admin/dashboard" style="color:#E61E24">← Back to Dashboard</a>
      </div>
      </body></html>
    `);
  };
}

module.exports = { requireRole };
