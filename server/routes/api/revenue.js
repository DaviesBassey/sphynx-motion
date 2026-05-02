const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// All revenue routes: superadmin only
router.use(requireRole('superadmin'));

// GET /api/admin/revenue/summary
router.get('/summary', async (req, res) => {
  const { from, to } = req.query;

  const [subResult, tokenResult, payoutResult] = await Promise.all([
    supabaseAdmin.from('subscriptions')
      .select('amount', { count: 'exact' })
      .eq('status', 'active')
      .gte('created_at', from || new Date(Date.now() - 30 * 86400000).toISOString())
      .lte('created_at', to || new Date().toISOString()),

    supabaseAdmin.from('soul_token_transactions')
      .select('amount')
      .eq('type', 'purchase')
      .gte('created_at', from || new Date(Date.now() - 30 * 86400000).toISOString())
      .lte('created_at', to || new Date().toISOString()),

    supabaseAdmin.from('creator_payouts')
      .select('amount')
      .eq('status', 'pending'),
  ]);

  const subscriptionRevenue = (subResult.data || []).reduce((s, r) => s + (r.amount || 0), 0);
  const tokenRevenue        = (tokenResult.data || []).reduce((s, r) => s + Math.abs(r.amount || 0), 0);
  const pendingPayouts      = (payoutResult.data || []).reduce((s, r) => s + (r.amount || 0), 0);

  res.json({
    subscriptionRevenue,
    tokenRevenue,
    totalRevenue:  subscriptionRevenue + tokenRevenue,
    pendingPayouts,
    netRevenue:    subscriptionRevenue + tokenRevenue - pendingPayouts,
    activeSubscriptions: subResult.count || 0,
  });
});

// GET /api/admin/revenue/subscriptions
router.get('/subscriptions', async (req, res) => {
  const { status } = req.query;
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from('subscriptions')
    .select('*, profiles!user_id(display_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscriptions: data, total: count });
});

// GET /api/admin/revenue/payouts
router.get('/payouts', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('creator_payouts')
    .select('*, profiles!creator_id(display_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ payouts: data });
});

// POST /api/admin/revenue/payouts/:id/process  — mark payout as processed
router.post('/payouts/:id/process', async (req, res) => {
  const { reference } = req.body;

  const { data, error } = await supabaseAdmin
    .from('creator_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_reference: reference, processed_by: req.user.id })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: req.user.id, action: 'process_payout', target_type: 'payout',
    target_id: req.params.id, details: { reference, amount: data.amount },
  });

  res.json({ payout: data });
});

module.exports = router;
