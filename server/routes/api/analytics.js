const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// GET /api/admin/analytics/overview
router.get('/overview', async (req, res) => {
  const [usersResult, subResult, viewsResult, modResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('episodes').select('views').limit(500),
    supabaseAdmin.from('moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const totalViews = (viewsResult.data || []).reduce((s, r) => s + (r.views || 0), 0);

  res.json({
    totalUsers:            usersResult.count || 0,
    activeSubscriptions:   subResult.count   || 0,
    totalViews,
    pendingModeration:     modResult.count   || 0,
  });
});

// GET /api/admin/analytics/top-content
router.get('/top-content', async (req, res) => {
  const { limit = 10 } = req.query;

  const { data, error } = await supabaseAdmin
    .from('episodes')
    .select('id, title, episode_number, views, completion_rate, series(title, poster_url)')
    .order('views', { ascending: false })
    .limit(Number(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json({ topContent: data });
});

// GET /api/admin/analytics/viewership?days=7
router.get('/viewership', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
  const from = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('view_events_combined')
    .select('created_at')
    .gte('created_at', from)
    .order('created_at');

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by day
  const byDay = {};
  (data || []).forEach(row => {
    const day = row.created_at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  res.json({ byDay });
});

// GET /api/admin/analytics/conversions
router.get('/conversions', async (req, res) => {
  const [freeUsers, paidUsers] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'free'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
  ]);

  const total = (freeUsers.count || 0) + (paidUsers.count || 0);
  const conversionRate = total > 0 ? ((paidUsers.count || 0) / total * 100).toFixed(1) : 0;

  res.json({
    freeUsers:      freeUsers.count  || 0,
    paidUsers:      paidUsers.count  || 0,
    conversionRate: Number(conversionRate),
  });
});

// GET /api/admin/analytics/audit-log  (superadmin only)
router.get('/audit-log', requireRole('superadmin'), async (req, res) => {
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  const { data, error, count } = await supabaseAdmin
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, details, created_at, profiles!admin_id(display_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ entries: data || [], total: count || 0, page: pageNum, limit: limitNum });
});

module.exports = router;
