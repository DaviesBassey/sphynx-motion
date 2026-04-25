const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// GET /api/admin/languages
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('languages')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ languages: data || [] });
});

// POST /api/admin/languages  (superadmin only)
router.post('/', requireRole('superadmin'), async (req, res) => {
  const { code, name, native_name, is_rtl, is_active } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  const { data, error } = await supabaseAdmin
    .from('languages')
    .insert({ code, name, native_name, is_rtl: !!is_rtl, is_active: is_active !== false })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ language: data });
});

// PATCH /api/admin/languages/:code  (superadmin only)
router.patch('/:code', requireRole('superadmin'), async (req, res) => {
  const { name, native_name, is_rtl, is_active, is_default } = req.body;
  // Only one default language allowed — clear existing default first
  if (is_default) {
    await supabaseAdmin.from('languages').update({ is_default: false }).neq('code', req.params.code);
  }
  const { data, error } = await supabaseAdmin
    .from('languages')
    .update({ name, native_name, is_rtl, is_active, is_default })
    .eq('code', req.params.code)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ language: data });
});

// GET /api/admin/languages/ui-translations?lang=zu
router.get('/ui-translations', async (req, res) => {
  const { lang = 'en', namespace } = req.query;
  let query = supabaseAdmin
    .from('ui_translations')
    .select('namespace, key, value')
    .eq('language_code', lang);
  if (namespace) query = query.eq('namespace', namespace);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Structure as { namespace: { key: value } }
  const out = {};
  (data || []).forEach(r => {
    if (!out[r.namespace]) out[r.namespace] = {};
    out[r.namespace][r.key] = r.value;
  });
  res.json({ translations: out, lang });
});

// PUT /api/admin/languages/ui-translations  (bulk upsert)
router.put('/ui-translations', requireRole('superadmin'), async (req, res) => {
  const { lang, rows } = req.body;  // rows: [{ namespace, key, value }]
  if (!lang || !Array.isArray(rows)) return res.status(400).json({ error: 'lang and rows[] required' });
  const records = rows.map(r => ({ language_code: lang, namespace: r.namespace, key: r.key, value: r.value }));
  const { error } = await supabaseAdmin
    .from('ui_translations')
    .upsert(records, { onConflict: 'language_code,namespace,key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, upserted: records.length });
});

module.exports = router;
