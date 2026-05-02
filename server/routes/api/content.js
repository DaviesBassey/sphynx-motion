const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();
const audit = (adminId, action, targetType, targetId, details) =>
  supabaseAdmin.from('admin_audit_log').insert({ admin_id: adminId, action, target_type: targetType, target_id: String(targetId), details });

// ── SERIES ────────────────────────────────────────────────────────────────────

// GET /api/admin/content/series
router.get('/series', async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('series')
    .select('id, title, slug, genre, age_rating, status, is_featured, is_trending, poster_url, created_at, profiles(display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search && search.length > 100) return res.status(400).json({ error: 'Search term too long' });
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ series: data, total: count, page: Number(page), limit: Number(limit) });
});

// POST /api/admin/content/series
router.post('/series', requireRole('admin'), async (req, res) => {
  const { title, description, genre, age_rating, language, is_featured, is_trending, status, poster_url, trailer_url } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { data, error } = await supabaseAdmin
    .from('series')
    .insert({ title, slug, description, genre, age_rating, language: language || 'en', is_featured: !!is_featured, is_trending: !!is_trending, status: status || 'draft', poster_url, trailer_url, created_by: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'create_series', 'series', data.id, { title });
  res.status(201).json({ series: data });
});

// PUT /api/admin/content/series/:id
router.put('/series/:id', requireRole('admin'), async (req, res) => {
  const allowed = ['title', 'description', 'genre', 'age_rating', 'language', 'is_featured', 'is_trending', 'status', 'poster_url', 'trailer_url'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await supabaseAdmin
    .from('series')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'update_series', 'series', req.params.id, updates);
  res.json({ series: data });
});

// DELETE /api/admin/content/series/:id (superadmin only)
router.delete('/series/:id', requireRole('superadmin'), async (req, res) => {
  const { error } = await supabaseAdmin.from('series').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'delete_series', 'series', req.params.id, {});
  res.json({ success: true });
});

// ── EPISODES ──────────────────────────────────────────────────────────────────

// GET /api/admin/content/episodes?series_id=xxx
router.get('/episodes', async (req, res) => {
  const { series_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('episodes')
    .select('*, series(title)', { count: 'exact' })
    .order('episode_number')
    .range(offset, offset + limit - 1);

  if (series_id) query = query.eq('series_id', series_id);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ episodes: data, total: count });
});

// POST /api/admin/content/episodes
router.post('/episodes', requireRole('admin'), async (req, res) => {
  const { series_id, episode_number, season_number, title, description, video_url, mux_asset_id, poster_url, duration, is_free, release_date, soul_cost, status } = req.body;

  if (!series_id || !episode_number || !title) {
    return res.status(400).json({ error: 'series_id, episode_number, and title are required' });
  }

  const safeStatus = ['live', 'draft', 'archived'].includes(status) ? status : 'draft';
  const insertRow = { series_id, episode_number, title, description, video_url, poster_url, duration: duration || 0, is_free: !!is_free, release_date: release_date || null, soul_cost: soul_cost || 0, status: safeStatus };
  if (season_number != null) insertRow.season_number = Number(season_number) || 1;
  if (mux_asset_id)          insertRow.mux_asset_id  = mux_asset_id;

  const { data, error } = await supabaseAdmin
    .from('episodes')
    .insert(insertRow)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'create_episode', 'episode', data.id, { series_id, episode_number, title });
  res.status(201).json({ episode: data });
});

// PUT /api/admin/content/episodes/:id
router.put('/episodes/:id', requireRole('admin'), async (req, res) => {
  const allowed = ['title', 'description', 'video_url', 'mux_playback_id', 'mux_asset_id', 'poster_url', 'duration', 'is_free', 'release_date', 'soul_cost', 'status', 'season_number'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('release_date' in updates) updates.release_date = updates.release_date || null;

  const { data, error } = await supabaseAdmin
    .from('episodes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'update_episode', 'episode', req.params.id, updates);
  res.json({ episode: data });
});

// DELETE /api/admin/content/episodes/:id (admin+)
router.delete('/episodes/:id', requireRole('admin'), async (req, res) => {
  const { error } = await supabaseAdmin.from('episodes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await audit(req.user.id, 'delete_episode', 'episode', req.params.id, {});
  res.json({ success: true });
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').select('*').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data });
});

router.post('/categories', requireRole('admin'), async (req, res) => {
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { data, error } = await supabaseAdmin.from('categories').insert({ name, slug, sort_order: sort_order || 0 }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ category: data });
});

// ── STATS ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const [{ count: seriesCount }, { count: episodeCount }, viewsResult] = await Promise.all([
    supabaseAdmin.from('series').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('episodes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('episodes').select('views').limit(1000),
  ]);

  const totalViews = (viewsResult.data || []).reduce((s, r) => s + (r.views || 0), 0);

  res.json({ series: seriesCount, episodes: episodeCount, totalViews });
});

module.exports = router;
