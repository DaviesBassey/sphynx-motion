const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');
const { _invalidateRoleCache } = require('../../middleware/auth');

const router = express.Router();
const audit = (adminId, action, targetId, details) =>
  supabaseAdmin.from('admin_audit_log').insert({ admin_id: adminId, action, target_type: 'user', target_id: String(targetId), details });

// GET /api/admin/users
router.get('/', async (req, res) => {
  const { search, role, status } = req.query;
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from('profiles')
    .select('id, display_name, email, role, soul_balance, subscription_status, is_suspended, created_at, last_active', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (role)   query = query.eq('role', role);
  if (status) query = query.eq('subscription_status', status);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ users: data, total: count, page: pageNum, limit: limitNum });
});

// GET /api/admin/users/:id
router.get('/:id', async (req, res) => {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*, subscriptions(*), soul_token_transactions(amount, type, created_at), content_reports(count)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'User not found' });
  res.json({ user: profile });
});

// PATCH /api/admin/users/:id/role  (superadmin only)
router.patch('/:id/role', requireRole('superadmin'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'creator', 'admin', 'superadmin'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }

  // Prevent demoting your own account
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', req.params.id)
    .select('id, display_name, role')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  _invalidateRoleCache(req.params.id);
  await audit(req.user.id, `set_role_${role}`, req.params.id, { previous_role: data.role, new_role: role });
  res.json({ user: data });
});

// POST /api/admin/users/:id/suspend
router.post('/:id/suspend', requireRole('admin'), async (req, res) => {
  const { reason } = req.body;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_suspended: true, suspension_reason: reason || 'Suspended by admin' })
    .eq('id', req.params.id)
    .select('id, display_name')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'suspend_user', req.params.id, { reason });
  res.json({ success: true, user: data });
});

// POST /api/admin/users/:id/unsuspend
router.post('/:id/unsuspend', requireRole('admin'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_suspended: false, suspension_reason: null })
    .eq('id', req.params.id)
    .select('id, display_name')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'unsuspend_user', req.params.id, {});
  res.json({ success: true, user: data });
});

// DELETE /api/admin/users/:id (superadmin only — soft delete via Supabase auth)
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'delete_user', req.params.id, {});
  res.json({ success: true });
});

module.exports = router;
