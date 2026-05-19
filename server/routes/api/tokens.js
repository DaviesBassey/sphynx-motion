const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');
const { validate, schemas } = require('../../lib/validation');

const router = express.Router();

// GET /api/admin/tokens/summary
router.get('/summary', async (req, res) => {
  const [issued, spent, purchased, fraudFlags] = await Promise.all([
    supabaseAdmin.from('soul_token_transactions').select('amount', { count: 'exact' }).eq('type', 'earn'),
    supabaseAdmin.from('soul_token_transactions').select('amount', { count: 'exact' }).eq('type', 'spend'),
    supabaseAdmin.from('soul_token_transactions').select('amount', { count: 'exact' }).eq('type', 'purchase'),
    supabaseAdmin.from('fraud_flags').select('*', { count: 'exact' }).eq('status', 'open'),
  ]);

  res.json({
    totalIssued:    issued.count || 0,
    totalSpent:     spent.count || 0,
    totalPurchased: purchased.count || 0,
    openFraudFlags: fraudFlags.count || 0,
  });
});

// GET /api/admin/tokens/transactions
router.get('/transactions', async (req, res) => {
  const { user_id, type } = req.query;
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from('soul_token_transactions')
    .select('*, profiles!user_id(display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (user_id) query = query.eq('user_id', user_id);
  if (type)    query = query.eq('type', type);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ transactions: data, total: count });
});

// POST /api/admin/tokens/grant  — manual token grant (admin+)
router.post('/grant', requireRole('admin'), validate(schemas.tokens.grant), async (req, res) => {
  const { user_id, amount, reason } = req.body;

  const MAX_GRANT = 100_000;
  if (!user_id || !amount || amount <= 0 || amount > MAX_GRANT) {
    return res.status(400).json({ error: `user_id and amount (1–${MAX_GRANT}) are required` });
  }

  // Resolve email to UUID if needed
  let resolvedId = user_id;
  if (user_id.includes('@')) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', user_id).single();
    if (!profile) return res.status(404).json({ error: 'No user found with that email address' });
    resolvedId = profile.id;
  }

  // Insert transaction and update balance atomically via RPC
  const { data, error } = await supabaseAdmin.rpc('grant_soul_tokens', {
    p_user_id: resolvedId,
    p_amount:  amount,
    p_reason:  reason || 'Admin grant',
    p_admin_id: req.user.id,
  });

  if (error) return res.status(500).json({ error: error.message });

  supabaseAdmin.from('admin_audit_log').insert({
    admin_id: req.user.id, action: 'grant_tokens', target_type: 'user',
    target_id: resolvedId, details: { amount, reason, requested_id: user_id },
  }).then(null, err => console.error('[audit]', err));

  res.json({ success: true, new_balance: data });
});

// POST /api/admin/tokens/deduct  — manual deduction (superadmin only)
router.post('/deduct', requireRole('superadmin'), validate(schemas.tokens.deduct), async (req, res) => {
  const { user_id, amount, reason } = req.body;

  if (!user_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'user_id and positive amount are required' });
  }

  const { data, error } = await supabaseAdmin.rpc('deduct_soul_tokens', {
    p_user_id:  user_id,
    p_amount:   amount,
    p_reason:   reason || 'Admin deduction',
    p_admin_id: req.user.id,
  });

  if (error) return res.status(500).json({ error: error.message });

  supabaseAdmin.from('admin_audit_log').insert({
    admin_id: req.user.id, action: 'deduct_tokens', target_type: 'user',
    target_id: user_id, details: { amount, reason },
  }).then(null, err => console.error('[audit]', err));

  res.json({ success: true, new_balance: data });
});

// GET /api/admin/tokens/packages
router.get('/packages', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('soul_token_packages').select('*').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ packages: data });
});

// PUT /api/admin/tokens/packages/:id  (superadmin only)
router.put('/packages/:id', requireRole('superadmin'), async (req, res) => {
  const { amount, price_zar, is_active, sort_order } = req.body;

  const { data, error } = await supabaseAdmin
    .from('soul_token_packages')
    .update({ amount, price_zar, is_active, sort_order })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ package: data });
});

module.exports = router;
