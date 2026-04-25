-- SPHYNX MOTION · Video Platform columns
-- Run after 003_i18n.sql

-- ─── MUX / CLOUDFLARE STREAM ─────────────────────────────────────────────────
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS mux_upload_id   TEXT,
  ADD COLUMN IF NOT EXISTS mux_asset_id    TEXT,
  ADD COLUMN IF NOT EXISTS mux_playback_id TEXT,
  ADD COLUMN IF NOT EXISTS cf_stream_uid   TEXT;

-- Quick lookup when Mux webhook fires
CREATE INDEX IF NOT EXISTS ep_mux_upload_idx ON public.episodes (mux_upload_id)
  WHERE mux_upload_id IS NOT NULL;

-- ─── VIEW COUNTER ─────────────────────────────────────────────────────────────
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;

-- ─── PUBLIC SESSION COOKIE (for public app users, separate from admin) ────────
-- The public app sets 'sphynx_session' cookie with the Supabase access token.
-- The episodes/play endpoint checks this OR the Authorization: Bearer header.
-- No schema change needed — the cookie/header carries a standard Supabase JWT.
