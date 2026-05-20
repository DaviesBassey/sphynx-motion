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

const ALLOWED_SETTING_KEYS = new Set([
  'maintenance_mode', 'allow_signups', 'allow_payments', 'site_name', 'support_email',
  'free_episode_limit', 'soul_token_daily_cap', 'soul_earn_rate', 'featured_series_limit',
  'trending_series_limit', 'default_language', 'content_moderation_enabled',
]);

// PATCH /api/admin/settings
router.patch('/', async (req, res) => {
  const updates = req.body;  // { key: value, ... }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Request body must be a settings object' });
  }

  const unknown = Object.keys(updates).filter(k => !ALLOWED_SETTING_KEYS.has(k));
  if (unknown.length) return res.status(400).json({ error: `Unknown setting keys: ${unknown.join(', ')}` });

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

  supabaseAdmin.from('admin_audit_log').insert({
    admin_id: req.user.id, action: 'update_settings', target_type: 'platform',
    target_id: 'platform_settings', details: updates,
  }).then(null, err => console.error('[audit]', err));

  res.json({ success: true });
});

module.exports = router;
