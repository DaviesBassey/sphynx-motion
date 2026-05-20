const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// POST /api/creators/apply — any authenticated user can apply
router.post('/apply', requireAuth, async (req, res) => {
  const { display_name, bio, country, payout_method, payout_details } = req.body;
  if (!display_name) return res.status(400).json({ error: 'display_name required' });

  const { data, error } = await supabaseAdmin
    .from('creators')
    .upsert({
      id: req.user.id,
      display_name, bio, country, payout_method,
      payout_details: payout_details || {},
      status: 'pending',
    }, { onConflict: 'id' })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ creator: data });
});

// GET /api/creators/me — creator's own profile
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('creators').select('*').eq('id', req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ creator: data });
});

// GET /api/admin/creators — admin list
router.get('/', requireRole('admin'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('creators')
    .select('*, profiles(email, display_name)')
    .order('applied_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ creators: data || [] });
});

// PATCH /api/admin/creators/:id — approve / suspend
router.patch('/:id', requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(403).json({ error: 'Cannot approve your own creator application' });
  }

  const { status, revenue_share } = req.body;
  const updates = {};
  if (status) updates.status = status;
  if (revenue_share !== undefined) updates.revenue_share = revenue_share;
  if (status === 'active') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = req.user.id;
    // Promote profile role to creator
    const { error: promoteErr } = await supabaseAdmin.from('profiles').update({ role: 'creator' }).eq('id', req.params.id);
    if (promoteErr) return res.status(500).json({ error: 'Failed to promote user role: ' + promoteErr.message });
  }
  const { data, error } = await supabaseAdmin.from('creators').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ creator: data });
});

module.exports = router;
