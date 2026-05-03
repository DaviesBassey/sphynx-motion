-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — pg_trgm search indexes + cron schedule cleanup
--
-- pg_cron is confirmed enabled on this project (Supabase Pro).
-- pg_trgm is available in the extension list — enable it here and add GIN
-- trigram indexes on every column that uses ILIKE in the application:
--
--   GET /api/public/series?search=      → series.title
--   GET /api/admin/content/series?search → series.title
--   GET /api/admin/users?search=        → profiles.display_name, profiles.email
--
-- GIN trigram indexes are picked up automatically by Postgres for ILIKE '%x%'
-- queries — no query changes required.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Enable pg_trgm ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ─── 2. GIN trigram index on series.title ─────────────────────────────────────
-- Used by both the public series search and the admin content search.
-- CONCURRENTLY: builds without locking the table for writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS series_title_trgm_idx
  ON public.series USING GIN (title extensions.gin_trgm_ops);

-- ─── 3. GIN trigram index on series.description ───────────────────────────────
-- Allows future full-text ILIKE search on description without schema changes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS series_desc_trgm_idx
  ON public.series USING GIN (description extensions.gin_trgm_ops);

-- ─── 4. GIN trigram indexes on profiles for admin user search ─────────────────
-- Admin user search ORs display_name and email with ILIKE.
CREATE INDEX CONCURRENTLY IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING GIN (display_name extensions.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS profiles_email_trgm_idx
  ON public.profiles USING GIN (email extensions.gin_trgm_ops);

-- ─── 5. Fix cron schedule — unconditional now that pg_cron is confirmed on ─────
-- Migration 013 wrapped the schedule in a conditional DO block. Since pg_cron
-- is enabled, drop the defensive wrapper and ensure the job exists.
-- cron.schedule() is idempotent by job name: calling it again updates the
-- schedule rather than creating a duplicate.
SELECT cron.schedule(
  'sphynx-data-retention',       -- job name (upserts if already exists)
  '0 2 * * 0',                   -- every Sunday at 02:00 UTC
  $$ SELECT public.run_data_retention() $$
);

-- ─── 6. Verify the job was registered ─────────────────────────────────────────
-- After running this migration you should see one row with jobname =
-- 'sphynx-data-retention' when you run: SELECT * FROM cron.job;
