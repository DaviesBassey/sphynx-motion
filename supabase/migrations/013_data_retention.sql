-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013 — Data Retention (POPIA / GDPR compliance)
-- Adds purge functions for high-growth event tables and an admin_audit_log
-- anonymisation procedure. Run on Supabase with pg_cron enabled (Pro+).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Purge raw view events older than 365 days ─────────────────────────────
-- view_events is the single largest growing table (~200B/row × millions/year).
-- Raw events older than 1 year have no operational value; aggregated stats are
-- stored on the episodes.views column via increment_episode_views().
CREATE OR REPLACE FUNCTION public.purge_old_view_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.view_events
  WHERE created_at < NOW() - INTERVAL '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. Purge daily_rewards older than 365 days ───────────────────────────────
-- daily_rewards is used only to gate "already claimed today" checks.
-- Rows older than 365 days serve no operational or legal purpose.
CREATE OR REPLACE FUNCTION public.purge_old_daily_rewards()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.daily_rewards
  WHERE rewarded_at < NOW() - INTERVAL '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. Anonymise admin_audit_log entries older than 730 days ────────────────
-- Audit logs must be retained for accountability but personal identifiers
-- (admin_id) should be anonymised after 2 years.
CREATE OR REPLACE FUNCTION public.anonymise_old_audit_log()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.admin_audit_log
  SET admin_id = '00000000-0000-0000-0000-000000000000'
  WHERE created_at < NOW() - INTERVAL '730 days'
    AND admin_id != '00000000-0000-0000-0000-000000000000';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. Purge resolved content_reports older than 365 days ──────────────────
CREATE OR REPLACE FUNCTION public.purge_old_resolved_reports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.content_reports
  WHERE status IN ('resolved', 'dismissed')
    AND created_at < NOW() - INTERVAL '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Master retention job — call all purge functions ───────────────────────
CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS JSONB AS $$
DECLARE
  v_views   INTEGER;
  v_rewards INTEGER;
  v_audit   INTEGER;
  v_reports INTEGER;
BEGIN
  SELECT public.purge_old_view_events()      INTO v_views;
  SELECT public.purge_old_daily_rewards()    INTO v_rewards;
  SELECT public.anonymise_old_audit_log()    INTO v_audit;
  SELECT public.purge_old_resolved_reports() INTO v_reports;

  RETURN jsonb_build_object(
    'view_events_deleted',   v_views,
    'daily_rewards_deleted', v_rewards,
    'audit_log_anonymised',  v_audit,
    'reports_deleted',       v_reports,
    'ran_at',                NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. Schedule weekly execution via pg_cron (Supabase Pro+) ────────────────
-- Runs every Sunday at 02:00 UTC. Requires pg_cron extension enabled in
-- Supabase Dashboard → Database → Extensions.
-- If pg_cron is not yet enabled, run the SELECT below manually via SQL editor
-- after enabling it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'sphynx-data-retention',
      '0 2 * * 0',
      $cron$SELECT public.run_data_retention()$cron$
    );
  END IF;
END;
$$;

-- ─── 7. RLS: only superadmin can call retention functions directly ─────────────
REVOKE ALL ON FUNCTION public.purge_old_view_events()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_daily_rewards()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anonymise_old_audit_log()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_resolved_reports() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_data_retention()         FROM PUBLIC;
