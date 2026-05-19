const express = require('express');
const multer  = require('multer');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();

// Ingestion & Payload Hardening:
// Drop payloads exceeding 5MB on raw multipart image uploads.
const memStorage  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const diskStorage = multer({ dest: '/tmp/sphynx-uploads/', limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

// POST /api/admin/uploads/poster
router.post('/poster', requireRole('admin'), memStorage.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  if (!ALLOWED_IMAGE.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images allowed' });
  }

  const ext  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype] || 'jpg';
  const path = `posters/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_POSTERS || 'posters')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_POSTERS || 'posters')
    .getPublicUrl(path);

  res.json({ url: publicUrl, path: data.path });
});

// POST /api/admin/uploads/trailer
router.post('/trailer', requireRole('admin'), memStorage.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  if (!ALLOWED_VIDEO.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only MP4 and MOV files allowed' });
  }

  const path = `trailers/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_TRAILERS || 'trailers')
    .upload(path, req.file.buffer, { contentType: 'video/mp4', upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_TRAILERS || 'trailers')
    .getPublicUrl(path);

  res.json({ url: publicUrl, path: data.path });
});

// POST /api/admin/uploads/video  — large file, streamed to Supabase Storage
router.post('/video', requireRole('admin'), diskStorage.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  if (!ALLOWED_VIDEO.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only MP4 and MOV files allowed' });
  }

  const fs   = require('fs');
  const path = `episodes/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  const fileBuffer = fs.readFileSync(req.file.path);
  fs.unlinkSync(req.file.path);  // Clean up temp file

  const { data, error } = await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_VIDEOS || 'videos')
    .upload(path, fileBuffer, { contentType: 'video/mp4', upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET_VIDEOS || 'videos')
    .getPublicUrl(path);

  res.json({ url: publicUrl, path: data.path });
});

module.exports = router;
