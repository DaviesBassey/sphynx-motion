const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { supabaseAdmin } = require('../../lib/supabase');

const router  = express.Router();
const limiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
router.use(limiter);

// ── FEATURED / TRENDING (Discover feed) ───────────────────────────────────────
router.get('/featured', async (req, res) => {
  const [featuredRes, trendingRes] = await Promise.all([
    supabaseAdmin.from('series')
      .select('id, title, slug, genre, age_rating, poster_url, trailer_url, description')
      .eq('status', 'live').eq('is_featured', true)
      .order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('series')
      .select('id, title, slug, genre, poster_url, views')
      .eq('status', 'live').eq('is_trending', true)
      .order('created_at', { ascending: false }).limit(6),
  ]);
  res.json({
    featured: featuredRes.data || [],
    trending: trendingRes.data || [],
  });
});

// ── ALL LIVE SERIES ────────────────────────────────────────────────────────────
router.get('/series', async (req, res) => {
  const { page = 1, limit = 24, genre, language, search, sort } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const orderCol = sort === 'views' ? 'views' : 'created_at';

  let query = supabaseAdmin
    .from('series')
    .select('id, title, slug, genre, language, age_rating, poster_url, is_featured, is_trending, views, description, episodes(count)', { count: 'exact' })
    .eq('status', 'live')
    .order(orderCol, { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (search && search.length > 100) return res.status(400).json({ error: 'Search term too long' });
  if (genre)    query = query.eq('genre', genre);
  if (language) query = query.eq('language', language);
  if (search)   query = query.ilike('title', search.length < 3 ? `${search}%` : `%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ series: data || [], total: count || 0 });
});

// ── SINGLE SERIES + EPISODES ──────────────────────────────────────────────────
router.get('/series/:idOrSlug', async (req, res) => {
  const { idOrSlug } = req.params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  let query = supabaseAdmin
    .from('series')
    .select(`
      id, title, slug, genre, age_rating, description, poster_url, trailer_url, language, views,
      episodes(id, title, episode_number, description, poster_url, duration, is_free, soul_cost,
               status, mux_playback_id, video_url, release_date)
    `)
    .eq('status', 'live');

  const { data, error } = await (isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)).single();
  if (error) return res.status(404).json({ error: 'Series not found' });

  data.episodes = (data.episodes || [])
    .filter(ep => ep.status === 'live')
    .sort((a, b) => a.episode_number - b.episode_number);

  res.json({ series: data });
});

// ── EPISODE PLAYBACK ──────────────────────────────────────────────────────────
// Free episodes: no auth needed. Premium: requires valid session + soul balance.
router.get('/episodes/:id/play', async (req, res) => {
  const { data: ep, error } = await supabaseAdmin
    .from('episodes')
    .select('id, is_free, soul_cost, mux_playback_id, video_url, status, series_id')
    .eq('id', req.params.id)
    .eq('status', 'live')
    .single();

  if (error || !ep) return res.status(404).json({ error: 'Episode not found' });

  if (!ep.is_free && ep.soul_cost > 0) {
    // Require auth via Authorization header or public session cookie
    const token = (req.headers.authorization || '').replace('Bearer ', '') || req.cookies?.sphynx_session;
    if (!token) return res.status(401).json({ error: 'Sign in to watch', code: 'auth_required' });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid session', code: 'auth_required' });

    const { data: profile } = await supabaseAdmin.from('profiles').select('soul_balance').eq('id', user.id).single();
    if (!profile || profile.soul_balance < ep.soul_cost) {
      return res.status(403).json({ error: 'Not enough Soul Tokens', code: 'insufficient_soul', cost: ep.soul_cost });
    }

    await supabaseAdmin.rpc('deduct_soul_tokens', {
      p_user_id: user.id, p_amount: ep.soul_cost, p_reason: `Watch episode ${ep.id}`,
    });
  }

  const isMux = !!ep.mux_playback_id;
  const url   = isMux ? `https://stream.mux.com/${ep.mux_playback_id}.m3u8` : ep.video_url;
  if (!url) return res.status(503).json({ error: 'Video not available yet' });

  // Increment view counter atomically (fire and forget)
  supabaseAdmin.rpc('increment_episode_views', { ep_id: ep.id }).catch(() => {
    // Fallback to non-atomic read-then-write if RPC not yet deployed
    supabaseAdmin.from('episodes').select('views').eq('id', ep.id).single()
      .then(({ data: r }) => r != null && supabaseAdmin.from('episodes').update({ views: (r.views || 0) + 1 }).eq('id', ep.id))
      .catch(() => {});
  });

  res.json({ url, type: isMux ? 'hls' : 'mp4', series_id: ep.series_id });
});

// ── SOUL TOKEN PACKAGES ────────────────────────────────────────────────────────
router.get('/soul-packages', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('soul_token_packages')
    .select('id, amount, price_zar, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ packages: data || [] });
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').select('id, name, slug').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data || [] });
});

// ── UI TRANSLATIONS (i18n for public app) ────────────────────────────────────
router.get('/translations/:lang', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('ui_translations')
    .select('namespace, key, value')
    .eq('language_code', req.params.lang);
  if (error) return res.status(500).json({ error: error.message });

  const out = {};
  (data || []).forEach(r => {
    if (!out[r.namespace]) out[r.namespace] = {};
    out[r.namespace][r.key] = r.value;
  });
  res.json({ translations: out, lang: req.params.lang });
});

module.exports = router;
