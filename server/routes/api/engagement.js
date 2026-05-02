const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');

const router = express.Router();

// Auth helper — reads sphynx_session cookie or Authorization header
async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.cookies?.sphynx_session;
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

// ─── WATCHLIST ────────────────────────────────────────────────────────────────

// GET /api/engage/watchlist
router.get('/watchlist', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { data, error } = await supabaseAdmin
    .from('watchlist')
    .select('series_id, added_at, series(id, title, slug, genre, poster_url, is_featured)')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ watchlist: (data || []).map(r => ({ ...r.series, added_at: r.added_at })) });
});

// POST /api/engage/watchlist/:seriesId
router.post('/watchlist/:seriesId', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { error } = await supabaseAdmin
    .from('watchlist')
    .upsert({ user_id: user.id, series_id: req.params.seriesId }, { onConflict: 'user_id,series_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ added: true });
});

// DELETE /api/engage/watchlist/:seriesId
router.delete('/watchlist/:seriesId', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  await supabaseAdmin.from('watchlist').delete().eq('user_id', user.id).eq('series_id', req.params.seriesId);
  res.json({ removed: true });
});

// ─── CONTINUE WATCHING ────────────────────────────────────────────────────────

// GET /api/engage/continue-watching
// Returns up to 10 in-progress series (5–94%), most recent episode per series,
// with full series metadata for rendering the recommendation row.
router.get('/continue-watching', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabaseAdmin
    .from('episode_progress')
    .select(`
      episode_id, progress_pct, watched_at,
      episodes!inner(
        episode_number, title, series_id,
        series!inner(id, title, slug, poster_url, genre, language)
      )
    `)
    .eq('user_id', user.id)
    .eq('completed', false)
    .gte('progress_pct', 5)
    .lt('progress_pct', 95)
    .order('watched_at', { ascending: false })
    .limit(40);

  if (error) return res.status(500).json({ error: error.message });

  // Deduplicate — one entry per series, most recent episode
  const seen = new Set();
  const items = [];
  for (const row of (data || [])) {
    const ep     = row.episodes;
    const series = ep?.series;
    if (!series || seen.has(series.id)) continue;
    seen.add(series.id);
    items.push({
      series_id:      series.id,
      series_title:   series.title,
      series_slug:    series.slug,
      poster_url:     series.poster_url,
      genre:          series.genre,
      language:       series.language,
      episode_id:     row.episode_id,
      episode_number: ep.episode_number,
      episode_title:  ep.title,
      progress_pct:   row.progress_pct,
      watched_at:     row.watched_at,
    });
    if (items.length >= 10) break;
  }

  res.json({ items });
});

// ─── EPISODE PROGRESS ─────────────────────────────────────────────────────────

// GET /api/engage/progress?series_id=xxx
router.get('/progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  let query = supabaseAdmin
    .from('episode_progress')
    .select('episode_id, progress_pct, completed, watched_at, episodes(episode_number, title, series_id, series(title, poster_url, slug))')
    .eq('user_id', user.id)
    .order('watched_at', { ascending: false });
  if (req.query.series_id) {
    query = query.eq('episodes.series_id', req.query.series_id);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ progress: data || [] });
});

// POST /api/engage/progress/:episodeId
router.post('/progress/:episodeId', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { progress_pct = 0 } = req.body;
  const pct = Math.min(100, Math.max(0, Number(progress_pct)));
  const completed = pct >= 90;

  const { data, error } = await supabaseAdmin
    .from('episode_progress')
    .upsert({
      user_id: user.id,
      episode_id: req.params.episodeId,
      progress_pct: pct,
      completed,
      watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,episode_id' })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Award watch bonus (once per episode completion)
  if (completed) {
    await supabaseAdmin.rpc('grant_soul_reward', {
      p_user_id: user.id, p_type: 'watch_episode', p_amount: 15,
      p_metadata: { episode_id: req.params.episodeId },
    }).catch(() => {});
  }

  res.json({ progress: data });
});

// ─── ECHO VOTES ───────────────────────────────────────────────────────────────

// GET /api/engage/votes/:episodeId — tallies + user's existing vote
router.get('/votes/:episodeId', async (req, res) => {
  const user = await getUser(req);
  const [tallies, myVote] = await Promise.all([
    supabaseAdmin.from('echo_vote_counts').select('choice_idx, votes').eq('episode_id', req.params.episodeId),
    user
      ? supabaseAdmin.from('echo_votes').select('choice_idx').eq('user_id', user.id).eq('episode_id', req.params.episodeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const counts = {};
  (tallies.data || []).forEach(r => { counts[r.choice_idx] = Number(r.votes); });
  res.json({ counts, myVote: myVote.data?.choice_idx ?? null });
});

// POST /api/engage/votes/:episodeId
router.post('/votes/:episodeId', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { choice_idx, soul_cost = 15 } = req.body;
  if (choice_idx === undefined) return res.status(400).json({ error: 'choice_idx required' });

  // Check existing vote
  const { data: existing } = await supabaseAdmin
    .from('echo_votes').select('id').eq('user_id', user.id).eq('episode_id', req.params.episodeId).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Already voted on this episode' });

  // Check soul balance
  const { data: profile } = await supabaseAdmin.from('profiles').select('soul_balance').eq('id', user.id).single();
  if (!profile || profile.soul_balance < soul_cost) {
    return res.status(403).json({ error: 'Not enough Soul Tokens', cost: soul_cost });
  }

  // Deduct soul and record vote atomically
  await supabaseAdmin.rpc('deduct_soul_tokens', { p_user_id: user.id, p_amount: soul_cost, p_reason: `Echo vote ep:${req.params.episodeId}` });
  const { error } = await supabaseAdmin.from('echo_votes').insert({ user_id: user.id, episode_id: req.params.episodeId, choice_idx, soul_spent: soul_cost });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ voted: true, choice_idx });
});

// ─── SOUL REWARDS ─────────────────────────────────────────────────────────────

// POST /api/engage/rewards/daily-login
router.post('/rewards/daily-login', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // Check if already claimed today
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin
    .from('daily_rewards')
    .select('id')
    .eq('user_id', user.id)
    .eq('reward_type', 'daily_login')
    .gte('rewarded_at', today + 'T00:00:00Z')
    .maybeSingle();

  if (existing) return res.json({ already_claimed: true, amount: 0 });

  const { data: balance, error } = await supabaseAdmin.rpc('grant_soul_reward', {
    p_user_id: user.id, p_type: 'daily_login', p_amount: 10, p_metadata: { date: today },
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ claimed: true, amount: 10, new_balance: balance });
});

// POST /api/engage/rewards/share
router.post('/rewards/share', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { series_id } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin.from('daily_rewards').select('id').eq('user_id', user.id).eq('reward_type', 'share_series').gte('rewarded_at', today + 'T00:00:00Z').maybeSingle();
  if (existing) return res.json({ already_claimed: true, amount: 0 });
  const { data: balance, error } = await supabaseAdmin.rpc('grant_soul_reward', {
    p_user_id: user.id, p_type: 'share_series', p_amount: 25, p_metadata: { series_id },
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ claimed: true, amount: 25, new_balance: balance });
});

// POST /api/engage/rewards/first-watch
router.post('/rewards/first-watch', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin.from('daily_rewards').select('id').eq('user_id', user.id).eq('reward_type', 'watch_episode').gte('rewarded_at', today + 'T00:00:00Z').maybeSingle();
  if (existing) return res.json({ already_claimed: true, amount: 0 });
  const { data: balance, error } = await supabaseAdmin.rpc('grant_soul_reward', {
    p_user_id: user.id, p_type: 'watch_episode', p_amount: 15, p_metadata: { date: today },
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ claimed: true, amount: 15, new_balance: balance });
});

// POST /api/engage/rewards/complete-ep3
router.post('/rewards/complete-ep3', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { data: existing } = await supabaseAdmin.from('daily_rewards').select('id').eq('user_id', user.id).eq('reward_type', 'complete_episode').maybeSingle();
  if (existing) return res.json({ already_claimed: true, amount: 0 });
  const { data: balance, error } = await supabaseAdmin.rpc('grant_soul_reward', {
    p_user_id: user.id, p_type: 'complete_episode', p_amount: 20, p_metadata: {},
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ claimed: true, amount: 20, new_balance: balance });
});

// GET /api/engage/rewards/status — returns which reward types already claimed today
router.get('/rewards/status', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.json({ claimed: [] });
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from('daily_rewards')
    .select('reward_type')
    .eq('user_id', user.id)
    .gte('rewarded_at', today + 'T00:00:00Z');
  // complete_episode is lifetime (one-time), not daily — check all time
  const { data: ep3 } = await supabaseAdmin.from('daily_rewards').select('id').eq('user_id', user.id).eq('reward_type', 'complete_episode').maybeSingle();
  const claimed = (data || []).map(r => r.reward_type);
  // map back to UI keys
  const mapped = [];
  if (claimed.includes('daily_login'))   mapped.push('daily_login');
  if (claimed.includes('watch_episode')) mapped.push('first_watch');
  if (claimed.includes('share_series'))  mapped.push('share_series');
  if (ep3)                               mapped.push('complete_ep3');
  res.json({ claimed: mapped });
});

// POST /api/engage/profile/avatar — upload profile photo
const multer = require('multer');
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/profile/avatar', memUpload.single('avatar'), async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext  = req.file.originalname.split('.').pop().toLowerCase();
  const path = `avatars/${user.id}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage.from('avatars').upload(path, req.file.buffer, {
    contentType: req.file.mimetype, upsert: true,
  });
  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  const avatar_url = urlData.publicUrl;

  await supabaseAdmin.from('profiles').update({ avatar_url }).eq('id', user.id);
  res.json({ avatar_url });
});

// ─── CONTENT REPORTS ──────────────────────────────────────────────────────────

// POST /api/engage/reports
router.post('/reports', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { content_type, content_id, reason } = req.body;
  if (!content_type || !reason) return res.status(400).json({ error: 'content_type and reason are required' });

  const validTypes = ['episode', 'series', 'comment'];
  if (!validTypes.includes(content_type)) return res.status(400).json({ error: 'Invalid content_type' });

  const { error } = await supabaseAdmin.from('content_reports').insert({
    reporter_id:  user.id,
    content_type,
    content_id:   content_id || null,
    reason,
    status:       'pending',
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ reported: true });
});

module.exports = router;
