-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — view_events hot/archive split
--
-- Problem: view_events grows ~200 B × millions of rows per year and is the
-- single largest table in the system. Every query (INSERT, admin SELECT) scans
-- it with RLS overhead and full-table indexes.
--
-- Solution: keep only the last 90 days in the live table (hot path); move
-- older rows weekly to view_events_archive (no RLS, minimal indexes).
-- A unified VIEW lets the 365-day analytics query remain unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Archive table ─────────────────────────────────────────────────────────
-- No FK constraints: referenced users/episodes may be deleted after archival.
-- No RLS: only accessible via SECURITY DEFINER functions or service-role key.
-- No PRIMARY KEY default: id comes from the live table and is already unique.
CREATE TABLE IF NOT EXISTS public.view_events_archive (
  id          UUID        NOT NULL,
  user_id     UUID,                        -- nullable — user may have been deleted
  episode_id  UUID        NOT NULL,
  watched_s   INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT view_events_archive_pkey PRIMARY KEY (id)
);

-- Indexes tuned for analytics queries (GROUP BY episode, GROUP BY day)
CREATE INDEX IF NOT EXISTS view_archive_episode_idx ON public.view_events_archive(episode_id);
CREATE INDEX IF NOT EXISTS view_archive_created_idx ON public.view_events_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS view_archive_user_idx    ON public.view_events_archive(user_id)
  WHERE user_id IS NOT NULL;

-- ─── 2. Unified view — analytics queries see live + archive seamlessly ─────────
-- The viewership analytics endpoint queries up to 365 days. After archival the
-- live table only holds 90 days, so without this view the chart would go blank.
CREATE OR REPLACE VIEW public.view_events_combined AS
  SELECT id, user_id, episode_id, watched_s, created_at
  FROM   public.view_events
  UNION ALL
  SELECT id, user_id, episode_id, watched_s, created_at
  FROM   public.view_events_archive;

-- ─── 3. Archive function — moves rows atomically (no data-loss window) ─────────
-- DELETE … RETURNING inside a CTE means delete and insert happen in the same
-- transaction. If the INSERT fails the DELETE is rolled back automatically.
CREATE OR REPLACE FUNCTION public.archive_old_view_events(
  p_cutoff_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  moved_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM public.view_events
    WHERE created_at < NOW() - (p_cutoff_days || ' days')::INTERVAL
    RETURNING id, user_id, episode_id, watched_s, created_at
  )
  INSERT INTO public.view_events_archive (id, user_id, episode_id, watched_s, created_at)
  SELECT id, user_id, episode_id, watched_s, created_at
  FROM   moved
  ON CONFLICT (id) DO NOTHING;   -- idempotent: re-running never duplicates rows

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. Hard-purge function for the archive (3-year retention) ───────────────
CREATE OR REPLACE FUNCTION public.purge_old_view_archive(
  p_cutoff_years INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.view_events_archive
  WHERE created_at < NOW() - (p_cutoff_years || ' years')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Replace run_data_retention() to use archive instead of delete ─────────
CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS JSONB AS $$
DECLARE
  v_archived     INTEGER;
  v_purge_arch   INTEGER;
  v_rewards      INTEGER;
  v_audit        INTEGER;
  v_reports      INTEGER;
BEGIN
  -- Hot→archive: move view_events rows older than 90 days
  SELECT public.archive_old_view_events(90)  INTO v_archived;
  -- Hard-purge archive rows older than 3 years
  SELECT public.purge_old_view_archive(3)    INTO v_purge_arch;
  -- Other retention tasks from migration 013
  SELECT public.purge_old_daily_rewards()    INTO v_rewards;
  SELECT public.anonymise_old_audit_log()    INTO v_audit;
  SELECT public.purge_old_resolved_reports() INTO v_reports;

  RETURN jsonb_build_object(
    'view_events_archived',      v_archived,
    'view_archive_purged',       v_purge_arch,
    'daily_rewards_deleted',     v_rewards,
    'audit_log_anonymised',      v_audit,
    'reports_deleted',           v_reports,
    'ran_at',                    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. Lock down archive functions (same as 013 pattern) ────────────────────
REVOKE ALL ON FUNCTION public.archive_old_view_events(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_view_archive(INTEGER)  FROM PUBLIC;

-- ─── 7. Update pg_cron schedule if extension is available ────────────────────
-- run_data_retention() is already scheduled from migration 013; since we
-- replaced the function body above the cron job automatically uses the new
-- logic — no schedule change needed.
