-- Migration 016: Enable RLS on tables missing Row-Level Security
-- Fixes Supabase security alert: rls_disabled_in_public
-- Tables affected: fraud_flags, view_events_archive

-- ── fraud_flags ───────────────────────────────────────────────────────────────
-- Contains internal fraud detection records. No public access; service role only.
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_flags_no_public_access" ON public.fraud_flags
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- ── view_events_archive ───────────────────────────────────────────────────────
-- Archived view events partitioned off from the live table. Service role only.
ALTER TABLE public.view_events_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_events_archive_no_public_access" ON public.view_events_archive
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
