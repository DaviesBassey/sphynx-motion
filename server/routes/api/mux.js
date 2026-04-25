const express = require('express');
const crypto  = require('crypto');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

function muxClient() {
  const { default: Mux } = require('@mux/mux-node');
  return new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET });
}

// POST /api/admin/uploads/mux-url
// Creates a Mux direct upload URL — episode video is uploaded from browser directly to Mux.
router.post('/mux-url', requireAuth, requireRole('admin'), async (req, res) => {
  if (!process.env.MUX_TOKEN_ID) return res.status(503).json({ error: 'Mux not configured — add MUX_TOKEN_ID and MUX_TOKEN_SECRET to server/.env' });
  try {
    const mux    = muxClient();
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.PUBLIC_ORIGIN || '*',
      new_asset_settings: {
        playback_policy: ['public'],
        mp4_support: 'capped-1080p',
      },
    });
    res.json({ upload_id: upload.id, url: upload.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/mux/webhook
// Mux calls this when an asset finishes processing.
// Webhook signing secret is optional but recommended (set MUX_WEBHOOK_SECRET).
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig  = req.headers['mux-signature'];
  const body = req.body;

  if (process.env.MUX_WEBHOOK_SECRET && sig) {
    const [, ts]   = (sig.match(/t=(\d+)/) || []);
    const [, v1]   = (sig.match(/v1=([a-f0-9]+)/) || []);
    const hmac     = crypto.createHmac('sha256', process.env.MUX_WEBHOOK_SECRET);
    const expected = hmac.update(`${ts}.${body.toString()}`).digest('hex');
    if (v1 !== expected) return res.status(401).send('Bad signature');
  }

  let event;
  try { event = JSON.parse(body.toString()); } catch { return res.status(400).send('Bad JSON'); }

  if (event.type === 'video.asset.ready') {
    const asset      = event.data;
    const uploadId   = asset.upload_id;
    const playbackId = (asset.playback_ids || []).find(p => p.policy === 'public')?.id;
    if (uploadId && playbackId) {
      await supabaseAdmin.from('episodes')
        .update({ mux_asset_id: asset.id, mux_playback_id: playbackId, status: 'draft' })
        .eq('mux_upload_id', uploadId);
    }
  }

  if (event.type === 'video.asset.errored') {
    const uploadId = event.data.upload_id;
    if (uploadId) {
      await supabaseAdmin.from('episodes')
        .update({ mux_asset_id: null, mux_playback_id: null })
        .eq('mux_upload_id', uploadId);
    }
  }

  res.json({ received: true });
});

module.exports = router;
