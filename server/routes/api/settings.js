const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// All settings routes: superadmin only
router.use(requireRole('superadmin'));

// GET /api/admin/settings
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value, updated_at');

  if (error) return res.status(500).json({ error: error.message });

  // Convert rows to key-value object
  const settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  res.json({ settings });
});

// PATCH /api/admin/settings
router.patch('/', async (req, res) => {
  const updates = req.body;  // { key: value, ... }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Request body must be a settings object' });
  }

  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? value : String(value),
    updated_by: req.user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: req.user.id, action: 'update_settings', target_type: 'platform',
    target_id: 'platform_settings', details: updates,
  });

  res.json({ success: true });
});

module.exports = router;
