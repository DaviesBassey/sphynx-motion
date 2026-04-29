/**
 * SPHYNX MOTION · Push Notifications
 *
 * POST /api/push/subscribe    — save a Web Push subscription (authenticated)
 * DELETE /api/push/subscribe  — remove subscription
 * POST /api/admin/push/send   — broadcast push (admin only)
 */
const express = require('express');
const webpush = require('web-push');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

function initWebpush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@sphynxmotion.com'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }
}
initWebpush();

// GET /api/push/vapid-public-key — public key for SW subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/push/subscribe
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys, platform } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint and keys required' });
  }
  await supabaseAdmin.from('push_subscriptions').upsert({
    user_id: req.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth:   keys.auth,
    platform: platform || 'web',
  }, { onConflict: 'endpoint' });
  res.json({ success: true });
});

// DELETE /api/push/subscribe
router.delete('/subscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', req.user.id);
  res.json({ success: true });
});

// POST /api/admin/push/send — admin broadcast
router.post('/send', requireAuth, requireRole('admin'), async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'VAPID keys not configured' });

  const { title, body, url, user_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  let query = supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (user_id) query = query.eq('user_id', user_id);

  const { data: subs } = await query.limit(500);
  if (!subs?.length) return res.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url: url || '/' });
  let sent = 0, failed = 0;

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 410) {
        // Expired — remove from DB
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }));

  res.json({ sent, failed });
});

module.exports = router;
