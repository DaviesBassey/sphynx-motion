-- SPHYNX MOTION · Row Level Security Policies
-- Even if the client-side is bypassed, users cannot read or write data they shouldn't.

-- ─── Enable RLS on all tables ─────────────────────────────────────────────────
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soul_token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soul_token_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- Anyone can read public profile fields
CREATE POLICY "profiles_read_own"     ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin_read"   ON public.profiles FOR SELECT USING (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── SERIES ───────────────────────────────────────────────────────────────────
-- Anyone can read live series
CREATE POLICY "series_public_read"  ON public.series FOR SELECT USING (status = 'live' OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "series_admin_write"  ON public.series FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "series_admin_update" ON public.series FOR UPDATE USING (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "series_super_delete" ON public.series FOR DELETE USING (public.get_my_role() = 'superadmin');

-- ─── EPISODES ─────────────────────────────────────────────────────────────────
-- Live episodes are public-readable
CREATE POLICY "episodes_public_read"  ON public.episodes FOR SELECT USING (status = 'live' OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "episodes_admin_write"  ON public.episodes FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "episodes_admin_update" ON public.episodes FOR UPDATE USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
CREATE POLICY "subs_own_read"    ON public.subscriptions FOR SELECT USING (user_id = auth.uid() OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "subs_super_write" ON public.subscriptions FOR INSERT WITH CHECK (public.get_my_role() = 'superadmin');
CREATE POLICY "subs_super_update" ON public.subscriptions FOR UPDATE USING (public.get_my_role() = 'superadmin');

-- ─── SOUL TOKEN TRANSACTIONS ──────────────────────────────────────────────────
CREATE POLICY "tokens_own_read"   ON public.soul_token_transactions FOR SELECT USING (user_id = auth.uid() OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "tokens_admin_write" ON public.soul_token_transactions FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','superadmin'));

-- ─── SOUL TOKEN PACKAGES ──────────────────────────────────────────────────────
CREATE POLICY "packages_public_read"  ON public.soul_token_packages FOR SELECT USING (is_active = TRUE OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "packages_super_write"  ON public.soul_token_packages FOR ALL USING (public.get_my_role() = 'superadmin');

-- ─── CONTENT REPORTS ──────────────────────────────────────────────────────────
CREATE POLICY "reports_own_read"  ON public.content_reports FOR SELECT USING (reporter_id = auth.uid() OR public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "reports_user_insert" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "reports_admin_update" ON public.content_reports FOR UPDATE USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── MODERATION QUEUE ─────────────────────────────────────────────────────────
CREATE POLICY "mod_admin_all" ON public.moderation_queue FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── CREATOR PAYOUTS ──────────────────────────────────────────────────────────
CREATE POLICY "payouts_creator_read" ON public.creator_payouts FOR SELECT USING (creator_id = auth.uid() OR public.get_my_role() = 'superadmin');
CREATE POLICY "payouts_super_write"  ON public.creator_payouts FOR ALL USING (public.get_my_role() = 'superadmin');

-- ─── ADMIN AUDIT LOG ──────────────────────────────────────────────────────────
-- Only superadmin can read audit logs. Inserts done via service role only.
CREATE POLICY "audit_super_read" ON public.admin_audit_log FOR SELECT USING (public.get_my_role() = 'superadmin');

-- ─── PLATFORM SETTINGS ────────────────────────────────────────────────────────
CREATE POLICY "settings_super_all" ON public.platform_settings FOR ALL USING (public.get_my_role() = 'superadmin');
-- Allow reading non-sensitive settings for the app
CREATE POLICY "settings_app_read"  ON public.platform_settings FOR SELECT
  USING (key IN ('maintenance_mode','echo_voting_enabled','free_episodes_per_series','subscription_price_zar'));

-- ─── VIEW EVENTS ──────────────────────────────────────────────────────────────
CREATE POLICY "views_user_insert" ON public.view_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "views_admin_read"  ON public.view_events FOR SELECT USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── STORED PROCEDURE: Grant Soul Tokens atomically ──────────────────────────
CREATE OR REPLACE FUNCTION public.grant_soul_tokens(
  p_user_id  UUID,
  p_amount   INTEGER,
  p_reason   TEXT,
  p_admin_id UUID
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE public.profiles SET soul_balance = soul_balance + p_amount WHERE id = p_user_id
    RETURNING soul_balance INTO new_balance;

  INSERT INTO public.soul_token_transactions (user_id, amount, type, description)
    VALUES (p_user_id, p_amount, 'grant', p_reason);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── STORED PROCEDURE: Deduct Soul Tokens atomically ─────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_soul_tokens(
  p_user_id  UUID,
  p_amount   INTEGER,
  p_reason   TEXT,
  p_admin_id UUID
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE public.profiles
    SET soul_balance = GREATEST(soul_balance - p_amount, 0)
    WHERE id = p_user_id
    RETURNING soul_balance INTO new_balance;

  INSERT INTO public.soul_token_transactions (user_id, amount, type, description)
    VALUES (p_user_id, -p_amount, 'deduct', p_reason);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
