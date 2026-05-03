-- SPHYNX MOTION · Database Schema
-- Run this in: Supabase Dashboard → SQL Editor

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- One row per auth.users entry. Role is the single source of truth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT,
  email               TEXT,
  avatar_url          TEXT,
  role                TEXT NOT NULL DEFAULT 'user'
                      CHECK (role IN ('user', 'creator', 'admin', 'superadmin')),
  soul_balance        INTEGER NOT NULL DEFAULT 0 CHECK (soul_balance >= 0),
  subscription_status TEXT NOT NULL DEFAULT 'free'
                      CHECK (subscription_status IN ('free', 'active', 'cancelled', 'expired')),
  is_suspended        BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason   TEXT,
  last_active         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Neo-Noir',       'neo-noir',        1),
  ('Romance',        'romance',         2),
  ('Thriller',       'thriller',        3),
  ('Drama',          'drama',           4),
  ('Sci-Fi',         'sci-fi',          5),
  ('Comedy',         'comedy',          6),
  ('Crime',          'crime',           7),
  ('Diaspora',       'diaspora',        8)
ON CONFLICT (slug) DO NOTHING;

-- ─── SERIES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.series (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  genre        TEXT,
  age_rating   TEXT DEFAULT 'PG' CHECK (age_rating IN ('PG','13','16','18')),
  language     TEXT DEFAULT 'en',
  poster_url   TEXT,
  trailer_url  TEXT,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending  BOOLEAN NOT NULL DEFAULT FALSE,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'live', 'archived')),
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EPISODES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episodes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id       UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_number  INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  video_url       TEXT,
  poster_url      TEXT,
  duration        INTEGER DEFAULT 0,  -- seconds
  is_free         BOOLEAN NOT NULL DEFAULT FALSE,
  soul_cost       INTEGER NOT NULL DEFAULT 0,
  release_date    TIMESTAMPTZ,
  views           INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'live', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(series_id, episode_number)
);

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan             TEXT NOT NULL DEFAULT 'soul_pass',
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  amount           NUMERIC(10,2),
  currency         TEXT DEFAULT 'ZAR',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  provider         TEXT,  -- 'apple', 'google', 'stripe', 'payfast'
  provider_id      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SOUL TOKEN TRANSACTIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.soul_token_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,  -- positive = credit, negative = debit
  type        TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'purchase', 'grant', 'deduct', 'refund')),
  reference   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SOUL TOKEN PACKAGES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.soul_token_packages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount     INTEGER NOT NULL,
  price_zar  NUMERIC(8,2) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.soul_token_packages (amount, price_zar, sort_order) VALUES
  (50,   15.00, 1),
  (150,  39.00, 2),
  (400,  89.00, 3),
  (1000, 199.00, 4)
ON CONFLICT DO NOTHING;

-- ─── CONTENT REPORTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id      UUID REFERENCES public.profiles(id),
  reported_user_id UUID REFERENCES public.profiles(id),
  content_type     TEXT NOT NULL,  -- 'episode', 'comment', 'series'
  content_id       UUID,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by      UUID REFERENCES public.profiles(id),
  resolved_at      TIMESTAMPTZ,
  resolution       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MODERATION QUEUE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_type  TEXT NOT NULL,  -- 'episode', 'series', 'comment_flag', 'user_report'
  submitter_id     UUID REFERENCES public.profiles(id),
  content_id       UUID,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'dismissed', 'escalated')),
  reviewed_by      UUID REFERENCES public.profiles(id),
  reviewed_at      TIMESTAMPTZ,
  review_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CREATOR PAYOUTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount             NUMERIC(10,2) NOT NULL,
  currency           TEXT DEFAULT 'ZAR',
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  payment_reference  TEXT,
  paid_at            TIMESTAMPTZ,
  processed_by       UUID REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ADMIN AUDIT LOG ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PLATFORM SETTINGS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value) VALUES
  ('daily_login_bonus',         '10'),
  ('watch_episode_bonus',       '5'),
  ('share_bonus',               '25'),
  ('soul_pass_multiplier',      '2'),
  ('new_user_bonus',            '50'),
  ('maintenance_mode',          'false'),
  ('echo_voting_enabled',       'true'),
  ('subscription_price_zar',    '59'),
  ('free_episodes_per_series',  '3')
ON CONFLICT (key) DO NOTHING;

-- ─── VIEW EVENTS (for analytics) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.view_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id),
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  watched_s  INTEGER DEFAULT 0,  -- seconds watched
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FRAUD FLAGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  flag_type   TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'confirmed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
-- SPHYNX MOTION · Internationalisation Schema
-- Run this after 001_schema.sql and 002_rls.sql

-- ─── LANGUAGES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.languages (
  code        TEXT PRIMARY KEY,           -- BCP-47: 'en', 'zu', 'xh', 'af', 'yo', 'sw'
  name        TEXT NOT NULL,              -- 'English', 'Zulu', 'Xhosa'
  native_name TEXT,                       -- 'isiZulu', 'isiXhosa', 'Afrikaans'
  is_rtl      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: African + global languages relevant to SPHYNX MOTION
INSERT INTO public.languages (code, name, native_name, is_default) VALUES
  ('en', 'English',    'English',   TRUE),
  ('zu', 'Zulu',       'isiZulu',   FALSE),
  ('xh', 'Xhosa',      'isiXhosa',  FALSE),
  ('af', 'Afrikaans',  'Afrikaans', FALSE),
  ('st', 'Sotho',      'Sesotho',   FALSE),
  ('tn', 'Tswana',     'Setswana',  FALSE),
  ('yo', 'Yoruba',     'Yorùbá',    FALSE),
  ('ig', 'Igbo',       'Igbo',      FALSE),
  ('ha', 'Hausa',      'Hausa',     FALSE),
  ('sw', 'Swahili',    'Kiswahili', FALSE),
  ('am', 'Amharic',    'አማርኛ',      FALSE),
  ('fr', 'French',     'Français',  FALSE),
  ('pt', 'Portuguese', 'Português', FALSE)
ON CONFLICT (code) DO NOTHING;

-- ─── USER LANGUAGE PREFERENCE ─────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT REFERENCES public.languages(code) DEFAULT 'en';

-- ─── UI TRANSLATIONS ──────────────────────────────────────────────────────────
-- Key/value pairs for app UI strings, namespaced by screen/component
CREATE TABLE IF NOT EXISTS public.ui_translations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  namespace     TEXT NOT NULL,   -- 'nav', 'home', 'player', 'profile', 'member', 'modals'
  key           TEXT NOT NULL,   -- 'discover', 'watchlist', 'soul_pass', 'sign_in', etc.
  value         TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(language_code, namespace, key)
);

-- Seed English UI strings (source of truth — other languages reference against these)
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  -- nav
  ('en','nav','home',         'Home'),
  ('en','nav','discover',     'Discover'),
  ('en','nav','soul_pass',    'Soul Pass'),
  ('en','nav','watchlist',    'Watchlist'),
  ('en','nav','profile',      'Profile'),
  -- home
  ('en','home','trending_now','Trending Now'),
  ('en','home','new_episodes','New Episodes'),
  ('en','home','continue',    'Continue Watching'),
  ('en','home','top_picks',   'Top Picks'),
  -- player
  ('en','player','episode',   'Episode'),
  ('en','player','free',      'Free'),
  ('en','player','premium',   'Premium'),
  ('en','player','unlock',    'Unlock for {cost} Soul'),
  -- profile
  ('en','profile','soul_score',     'Soul Score'),
  ('en','profile','episodes',       'Episodes'),
  ('en','profile','echo_votes',     'Echo Votes'),
  ('en','profile','sign_in',        'Log In'),
  ('en','profile','sign_out',       'Log Out'),
  ('en','profile','create_account', 'Create Account'),
  ('en','profile','wallet',         'My Wallet'),
  ('en','profile','earn_soul',      'Earn Soul'),
  -- member
  ('en','member','join_soul_pass',  'Join Soul Pass'),
  ('en','member','buy_soul',        'Buy Soul Tokens'),
  ('en','member','token_terms',     'Token Terms'),
  ('en','member','all_series',      'All original series'),
  -- Zulu translations (partial — expand as needed)
  ('zu','nav','home',         'Ikhaya'),
  ('zu','nav','discover',     'Thola'),
  ('zu','nav','soul_pass',    'I-Soul Pass'),
  ('zu','nav','watchlist',    'Uhlu Lokubuka'),
  ('zu','nav','profile',      'Iphrofayili'),
  ('zu','profile','sign_in',  'Ngena'),
  ('zu','profile','sign_out', 'Phuma'),
  -- Xhosa
  ('xh','nav','home',         'Ekhaya'),
  ('xh','nav','discover',     'Fumana'),
  ('xh','nav','watchlist',    'Uluhlu Lokujongelwa'),
  ('xh','profile','sign_in',  'Ngena'),
  -- Afrikaans
  ('af','nav','home',         'Tuis'),
  ('af','nav','discover',     'Ontdek'),
  ('af','nav','watchlist',    'Kyklys'),
  ('af','profile','sign_in',  'Teken in'),
  -- Yoruba
  ('yo','nav','home',         'Ile'),
  ('yo','nav','discover',     'Ṣàwárí'),
  ('yo','profile','sign_in',  'Wọle')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── SERIES TRANSLATIONS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.series_translations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id     UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(series_id, language_code)
);

-- ─── EPISODE TRANSLATIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episode_translations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id    UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(episode_id, language_code)
);

-- ─── SUBTITLE TRACKS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subtitle_tracks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id    UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  label         TEXT NOT NULL,       -- 'Zulu', 'English (CC)'
  format        TEXT NOT NULL DEFAULT 'vtt'  CHECK (format IN ('vtt','srt')),
  url           TEXT NOT NULL,       -- Supabase Storage URL
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(episode_id, language_code)
);

-- ─── FALLBACK HELPER: get translated series ───────────────────────────────────
-- Returns: requested lang → English → original. Never null.
CREATE OR REPLACE FUNCTION public.get_series_title(
  p_series_id     UUID,
  p_lang          TEXT DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  -- 1. Requested language
  SELECT title INTO v_result FROM public.series_translations
    WHERE series_id = p_series_id AND language_code = p_lang AND title IS NOT NULL;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 2. English fallback
  IF p_lang <> 'en' THEN
    SELECT title INTO v_result FROM public.series_translations
      WHERE series_id = p_series_id AND language_code = 'en' AND title IS NOT NULL;
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;

  -- 3. Original series title
  SELECT title INTO v_result FROM public.series WHERE id = p_series_id;
  RETURN COALESCE(v_result, '');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_series_description(
  p_series_id UUID, p_lang TEXT DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE v_result TEXT;
BEGIN
  SELECT description INTO v_result FROM public.series_translations
    WHERE series_id = p_series_id AND language_code = p_lang AND description IS NOT NULL;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF p_lang <> 'en' THEN
    SELECT description INTO v_result FROM public.series_translations
      WHERE series_id = p_series_id AND language_code = 'en' AND description IS NOT NULL;
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;
  SELECT description INTO v_result FROM public.series WHERE id = p_series_id;
  RETURN COALESCE(v_result, '');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── RLS FOR NEW TABLES ───────────────────────────────────────────────────────
ALTER TABLE public.languages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_translations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitle_tracks     ENABLE ROW LEVEL SECURITY;

-- Languages: all users can read active languages
CREATE POLICY "lang_public_read"   ON public.languages FOR SELECT USING (is_active = TRUE);
CREATE POLICY "lang_admin_write"   ON public.languages FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

-- UI translations: public read, admin write
CREATE POLICY "ui_trans_public_read"  ON public.ui_translations FOR SELECT USING (TRUE);
CREATE POLICY "ui_trans_admin_write"  ON public.ui_translations FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

-- Series/episode translations: same access model as parent tables
CREATE POLICY "series_trans_read"   ON public.series_translations FOR SELECT USING (TRUE);
CREATE POLICY "series_trans_write"  ON public.series_translations FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

CREATE POLICY "ep_trans_read"       ON public.episode_translations FOR SELECT USING (TRUE);
CREATE POLICY "ep_trans_write"      ON public.episode_translations FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));

-- Subtitle tracks: public read, admin write
CREATE POLICY "subs_public_read"    ON public.subtitle_tracks FOR SELECT USING (TRUE);
CREATE POLICY "subs_admin_write"    ON public.subtitle_tracks FOR ALL USING (public.get_my_role() IN ('admin','superadmin'));
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
-- SPHYNX MOTION · Payment Integration
-- Run after 004_video.sql

-- ─── STRIPE FIELDS ON PROFILES ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ─── PAYMENT ORDERS ───────────────────────────────────────────────────────────
-- One row per payment attempt (web or mobile). Linked to subscriptions or tokens.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('stripe','payfast','apple','google','revenuecat')),
  provider_order_id    TEXT,          -- Stripe session/PI id, PayFast m_payment_id, etc.
  product_type         TEXT NOT NULL CHECK (product_type IN ('soul_pass','soul_tokens')),
  product_id           TEXT,          -- Stripe price_id, package id, IAP product id
  amount               NUMERIC(10,2),
  currency             TEXT DEFAULT 'ZAR',
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  tokens_granted       INTEGER DEFAULT 0,
  meta                 JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STRIPE COLUMNS ON SUBSCRIPTIONS ─────────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id         TEXT,
  ADD COLUMN IF NOT EXISTS payfast_payment_id       TEXT,
  ADD COLUMN IF NOT EXISTS revenuecat_entitlement   TEXT,
  ADD COLUMN IF NOT EXISTS renewed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end     BOOLEAN DEFAULT FALSE;

-- ─── PUSH NOTIFICATION SUBSCRIPTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  platform   TEXT DEFAULT 'web',  -- 'web', 'ios', 'android'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_own"        ON public.payment_orders     FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "orders_admin"      ON public.payment_orders     FOR ALL    USING (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "push_own_insert"   ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "push_own_select"   ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_admin"        ON public.push_subscriptions FOR ALL    USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── HELPER: activate subscription after payment ─────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id           UUID,
  p_plan              TEXT,
  p_provider          TEXT,
  p_provider_sub_id   TEXT DEFAULT NULL,
  p_price_id          TEXT DEFAULT NULL,
  p_amount            NUMERIC DEFAULT NULL,
  p_currency          TEXT DEFAULT 'ZAR',
  p_expires_at        TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.subscriptions
    (user_id, plan, status, provider, provider_id, stripe_subscription_id, stripe_price_id,
     amount, currency, expires_at, started_at)
  VALUES
    (p_user_id, p_plan, 'active', p_provider, p_provider_sub_id, p_provider_sub_id,
     p_price_id, p_amount, p_currency, p_expires_at, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'active', provider = p_provider, provider_id = p_provider_sub_id,
        stripe_subscription_id = p_provider_sub_id, stripe_price_id = p_price_id,
        amount = p_amount, currency = p_currency, expires_at = p_expires_at,
        renewed_at = NOW();

  UPDATE public.profiles
  SET subscription_status = 'active', updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SPHYNX MOTION · Extended Language Seed
-- Run after 003_i18n.sql
-- Adds languages missing from the initial seed

INSERT INTO public.languages (code, name, native_name) VALUES
  ('nso', 'Sepedi',          'Sesepedi'),
  ('ve',  'Tshivenda',       'Tshivenḓa'),
  ('ts',  'Tsonga',          'Xitsonga'),
  ('pcm', 'Nigerian Pidgin', 'Naijá'),
  ('ar',  'Arabic',          'العربية')
ON CONFLICT (code) DO NOTHING;

-- Arabic is RTL — set flag whether it was just inserted or already existed
UPDATE public.languages SET is_rtl = TRUE WHERE code = 'ar';

-- Correct display names that shipped with generic labels
UPDATE public.languages SET name = 'Zulu',     native_name = 'isiZulu'   WHERE code = 'zu' AND name = 'Zulu';
UPDATE public.languages SET name = 'Xhosa',    native_name = 'isiXhosa'  WHERE code = 'xh' AND name = 'Xhosa';
UPDATE public.languages SET name = 'Sesotho',  native_name = 'Sesotho'   WHERE code = 'st';
UPDATE public.languages SET name = 'Setswana', native_name = 'Setswana'  WHERE code = 'tn';
UPDATE public.languages SET name = 'Swahili',  native_name = 'Kiswahili' WHERE code = 'sw';
-- SPHYNX MOTION · i18n String Expansion (v0.4)
-- Run after 003_i18n.sql and 006_languages_seed.sql
-- Adds missing English source keys and full translation sets for 7 languages.

-- ─── EXPAND ENGLISH SOURCE KEYS ───────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  -- nav (already seeded in 003, included here for safety)
  ('en','nav','home',              'Home'),
  ('en','nav','discover',          'Discover'),
  ('en','nav','soul_pass',         'Soul Pass'),
  ('en','nav','watchlist',         'Watchlist'),
  ('en','nav','profile',           'Profile'),
  -- home screen
  ('en','home','most_trending',    'Most Trending'),
  ('en','home','start_watching',   'Start Watching'),
  ('en','home','new_episodes',     'New Episodes'),
  ('en','home','continue',         'Continue Watching'),
  ('en','home','top_picks',        'Top Picks'),
  -- player
  ('en','player','episode',        'Episode'),
  ('en','player','free',           'Free'),
  ('en','player','premium',        'Premium'),
  ('en','player','unlock',         'Unlock for {cost} Soul'),
  -- profile screen
  ('en','profile','title',         'Profile'),
  ('en','profile','soul_score',    'Soul Score'),
  ('en','profile','episodes',      'Episodes'),
  ('en','profile','echo_votes',    'Echo Votes'),
  ('en','profile','log_in',        'Log in'),
  ('en','profile','log_out',       'Log out'),
  ('en','profile','log_in_btn',    'Log In →'),
  ('en','profile','sign_in',       'Log In'),
  ('en','profile','sign_out',      'Log Out'),
  ('en','profile','create_account','Create Account'),
  ('en','profile','wallet',        'My Wallet'),
  ('en','profile','earn_soul',     'Earn Soul'),
  ('en','profile','history',       'History'),
  ('en','profile','language',      'Language'),
  ('en','profile','support',       'Help & Support'),
  -- member / Soul Pass screen
  ('en','member','join_soul_pass', 'Join Soul Pass'),
  ('en','member','join_now',       'Join Now'),
  ('en','member','subscribe_now',  'Subscribe Now →'),
  ('en','member','buy_soul',       'Buy Soul Tokens'),
  ('en','member','all_series',     'All original series'),
  ('en','member','daily_soul',     'Daily Soul Points'),
  ('en','member','hd_quality',     'HD Quality'),
  ('en','member','echo_voting',    'Echo Voting'),
  ('en','member','choose_plan',    'Choose Plan'),
  ('en','member','monthly',        'Monthly'),
  ('en','member','annual',         'Annual'),
  ('en','member','get_monthly',    'Get Monthly'),
  ('en','member','get_annual',     'Get Annual'),
  ('en','member','token_terms',    'Token Terms')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── ZULU (isiZulu) ────────────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('zu','nav','home',              'Ikhaya'),
  ('zu','nav','discover',          'Thola'),
  ('zu','nav','soul_pass',         'I-Soul Pass'),
  ('zu','nav','watchlist',         'Uhlu Lokubuka'),
  ('zu','nav','profile',           'Iphrofayili'),
  ('zu','home','most_trending',    'Okudumile Kakhulu'),
  ('zu','home','start_watching',   'Qala Ukubuka'),
  ('zu','profile','title',         'Iphrofayili'),
  ('zu','profile','soul_score',    'Inani le-Soul'),
  ('zu','profile','episodes',      'Amaqophelo'),
  ('zu','profile','echo_votes',    'Amavoti e-Echo'),
  ('zu','profile','log_in',        'Ngena'),
  ('zu','profile','log_out',       'Phuma'),
  ('zu','profile','log_in_btn',    'Ngena →'),
  ('zu','profile','sign_in',       'Ngena'),
  ('zu','profile','sign_out',      'Phuma'),
  ('zu','profile','create_account','Yenza I-Akhawunti'),
  ('zu','profile','wallet',        'Isikhwama Sami'),
  ('zu','profile','earn_soul',     'Thola I-Soul'),
  ('zu','profile','history',       'Umlando'),
  ('zu','profile','language',      'Ulimi'),
  ('zu','profile','support',       'Usizo'),
  ('zu','member','join_soul_pass', 'Joyina I-Soul Pass'),
  ('zu','member','join_now',       'Joyina Manje'),
  ('zu','member','buy_soul',       'Thenga I-Soul Tokens'),
  ('zu','member','all_series',     'Wonke Amaqophelo'),
  ('zu','member','monthly',        'Inyanga Nenyanga'),
  ('zu','member','annual',         'Unyaka Ngonyaka'),
  ('zu','member','get_monthly',    'Thola Inyanga Nenyanga'),
  ('zu','member','get_annual',     'Thola Unyaka Ngonyaka')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── XHOSA (isiXhosa) ─────────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('xh','nav','home',              'Ekhaya'),
  ('xh','nav','discover',          'Fumana'),
  ('xh','nav','soul_pass',         'I-Soul Pass'),
  ('xh','nav','watchlist',         'Uluhlu Lokujongelwa'),
  ('xh','nav','profile',           'Iphrofayile'),
  ('xh','home','most_trending',    'Okudumileyo Kakhulu'),
  ('xh','home','start_watching',   'Qala Ukujonga'),
  ('xh','profile','log_in',        'Ngena'),
  ('xh','profile','log_out',       'Phuma'),
  ('xh','profile','log_in_btn',    'Ngena →'),
  ('xh','profile','sign_in',       'Ngena'),
  ('xh','profile','sign_out',      'Phuma'),
  ('xh','profile','create_account','Yenza I-Akhawunti'),
  ('xh','profile','wallet',        'Isikhwama Sam'),
  ('xh','profile','earn_soul',     'Fumana I-Soul'),
  ('xh','profile','history',       'Imbali'),
  ('xh','profile','language',      'Ulwimi'),
  ('xh','member','join_soul_pass', 'Joyina I-Soul Pass'),
  ('xh','member','join_now',       'Joyina Ngoku'),
  ('xh','member','all_series',     'Yonke Imiqula'),
  ('xh','member','monthly',        'Enyangeni'),
  ('xh','member','annual',         'Ngonyaka')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── AFRIKAANS ────────────────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('af','nav','home',              'Tuis'),
  ('af','nav','discover',          'Ontdek'),
  ('af','nav','soul_pass',         'Soul Pas'),
  ('af','nav','watchlist',         'Kyklys'),
  ('af','nav','profile',           'Profiel'),
  ('af','home','most_trending',    'Mees Gewild'),
  ('af','home','start_watching',   'Begin Kyk'),
  ('af','profile','title',         'Profiel'),
  ('af','profile','soul_score',    'Soul Telling'),
  ('af','profile','episodes',      'Episodes'),
  ('af','profile','echo_votes',    'Echo Stemme'),
  ('af','profile','log_in',        'Teken in'),
  ('af','profile','log_out',       'Teken uit'),
  ('af','profile','log_in_btn',    'Teken In →'),
  ('af','profile','sign_in',       'Teken In'),
  ('af','profile','sign_out',      'Teken Uit'),
  ('af','profile','create_account','Skep Rekening'),
  ('af','profile','wallet',        'My Beursie'),
  ('af','profile','earn_soul',     'Verdien Soul'),
  ('af','profile','history',       'Geskiedenis'),
  ('af','profile','language',      'Taal'),
  ('af','profile','support',       'Hulp & Ondersteuning'),
  ('af','member','join_soul_pass', 'Sluit Aan by Soul Pas'),
  ('af','member','join_now',       'Sluit Nou Aan'),
  ('af','member','buy_soul',       'Koop Soul Tokens'),
  ('af','member','all_series',     'Alle oorspronklike reekse'),
  ('af','member','monthly',        'Maandeliks'),
  ('af','member','annual',         'Jaarliks'),
  ('af','member','get_monthly',    'Kry Maandeliks'),
  ('af','member','get_annual',     'Kry Jaarliks')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── SESOTHO ──────────────────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('st','nav','home',              'Lapeng'),
  ('st','nav','discover',          'Fumana'),
  ('st','nav','soul_pass',         'Soul Pass'),
  ('st','nav','watchlist',         'Lethathamo la Buka'),
  ('st','nav','profile',           'Profaeili'),
  ('st','home','most_trending',    'Tse Ratehang Haholo'),
  ('st','home','start_watching',   'Qala ho Sheba'),
  ('st','profile','log_in',        'Kena'),
  ('st','profile','log_out',       'Tswa'),
  ('st','profile','sign_in',       'Kena'),
  ('st','profile','sign_out',      'Tswa'),
  ('st','profile','language',      'Puo'),
  ('st','member','join_now',       'Kena Hona Joale')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── SWAHILI (Kiswahili) ──────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('sw','nav','home',              'Nyumbani'),
  ('sw','nav','discover',          'Gundua'),
  ('sw','nav','soul_pass',         'Pasi ya Roho'),
  ('sw','nav','watchlist',         'Orodha ya Kutazama'),
  ('sw','nav','profile',           'Wasifu'),
  ('sw','home','most_trending',    'Kinachochaguliwa Zaidi'),
  ('sw','home','start_watching',   'Anza Kutazama'),
  ('sw','profile','title',         'Wasifu'),
  ('sw','profile','soul_score',    'Alama ya Roho'),
  ('sw','profile','episodes',      'Vipindi'),
  ('sw','profile','echo_votes',    'Kura za Echo'),
  ('sw','profile','log_in',        'Ingia'),
  ('sw','profile','log_out',       'Toka'),
  ('sw','profile','log_in_btn',    'Ingia →'),
  ('sw','profile','sign_in',       'Ingia'),
  ('sw','profile','sign_out',      'Toka'),
  ('sw','profile','create_account','Fungua Akaunti'),
  ('sw','profile','wallet',        'Mkoba Wangu'),
  ('sw','profile','earn_soul',     'Pata Roho'),
  ('sw','profile','history',       'Historia'),
  ('sw','profile','language',      'Lugha'),
  ('sw','profile','support',       'Msaada'),
  ('sw','member','join_soul_pass', 'Jiunge na Pasi ya Roho'),
  ('sw','member','join_now',       'Jiunge Sasa'),
  ('sw','member','buy_soul',       'Nunua Roho Tokens'),
  ('sw','member','all_series',     'Mfululizo wote wa asili'),
  ('sw','member','monthly',        'Kila Mwezi'),
  ('sw','member','annual',         'Kila Mwaka')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── YORUBA ───────────────────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('yo','nav','home',              'Ile'),
  ('yo','nav','discover',          'Ṣàwárí'),
  ('yo','nav','soul_pass',         'Soul Pass'),
  ('yo','nav','watchlist',         'Atokọ Wiwo'),
  ('yo','nav','profile',           'Profáìlì'),
  ('yo','home','most_trending',    'Ohun Tó Gbajúmọ Jùlọ'),
  ('yo','home','start_watching',   'Bẹrẹ Wiwo'),
  ('yo','profile','log_in',        'Wọle'),
  ('yo','profile','log_out',       'Jade'),
  ('yo','profile','sign_in',       'Wọle'),
  ('yo','profile','sign_out',      'Jade'),
  ('yo','profile','create_account','Ṣẹdá Àkọọlẹ'),
  ('yo','profile','wallet',        'Àpamọwọ Mi'),
  ('yo','profile','earn_soul',     'Jèrè Soul'),
  ('yo','profile','history',       'Ìtàn'),
  ('yo','profile','language',      'Èdè'),
  ('yo','member','join_now',       'Darapọ Mọ Bayi'),
  ('yo','member','join_soul_pass', 'Darapọ Mọ Soul Pass')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── FRENCH (Français) ───────────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('fr','nav','home',              'Accueil'),
  ('fr','nav','discover',          'Découvrir'),
  ('fr','nav','soul_pass',         'Soul Pass'),
  ('fr','nav','watchlist',         'Ma Liste'),
  ('fr','nav','profile',           'Profil'),
  ('fr','home','most_trending',    'Tendances'),
  ('fr','home','start_watching',   'Commencer'),
  ('fr','profile','title',         'Profil'),
  ('fr','profile','soul_score',    'Score Soul'),
  ('fr','profile','episodes',      'Épisodes'),
  ('fr','profile','echo_votes',    'Votes Echo'),
  ('fr','profile','log_in',        'Se connecter'),
  ('fr','profile','log_out',       'Se déconnecter'),
  ('fr','profile','log_in_btn',    'Se connecter →'),
  ('fr','profile','sign_in',       'Se connecter'),
  ('fr','profile','sign_out',      'Se déconnecter'),
  ('fr','profile','create_account','Créer un compte'),
  ('fr','profile','wallet',        'Mon Portefeuille'),
  ('fr','profile','earn_soul',     'Gagner Soul'),
  ('fr','profile','history',       'Historique'),
  ('fr','profile','language',      'Langue'),
  ('fr','profile','support',       'Aide & Support'),
  ('fr','member','join_soul_pass', 'Rejoindre Soul Pass'),
  ('fr','member','join_now',       'Rejoindre'),
  ('fr','member','buy_soul',       'Acheter des Soul Tokens'),
  ('fr','member','all_series',     'Toutes les séries originales'),
  ('fr','member','monthly',        'Mensuel'),
  ('fr','member','annual',         'Annuel'),
  ('fr','member','get_monthly',    'Obtenir Mensuel'),
  ('fr','member','get_annual',     'Obtenir Annuel')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── PORTUGUESE (Português) ───────────────────────────────────────────────────
INSERT INTO public.ui_translations (language_code, namespace, key, value) VALUES
  ('pt','nav','home',              'Início'),
  ('pt','nav','discover',          'Descobrir'),
  ('pt','nav','soul_pass',         'Soul Pass'),
  ('pt','nav','watchlist',         'Minha Lista'),
  ('pt','nav','profile',           'Perfil'),
  ('pt','home','most_trending',    'Tendências'),
  ('pt','home','start_watching',   'Começar'),
  ('pt','profile','title',         'Perfil'),
  ('pt','profile','soul_score',    'Pontuação Soul'),
  ('pt','profile','episodes',      'Episódios'),
  ('pt','profile','echo_votes',    'Votos Echo'),
  ('pt','profile','log_in',        'Entrar'),
  ('pt','profile','log_out',       'Sair'),
  ('pt','profile','log_in_btn',    'Entrar →'),
  ('pt','profile','sign_in',       'Entrar'),
  ('pt','profile','sign_out',      'Sair'),
  ('pt','profile','create_account','Criar Conta'),
  ('pt','profile','wallet',        'Minha Carteira'),
  ('pt','profile','earn_soul',     'Ganhar Soul'),
  ('pt','profile','history',       'Histórico'),
  ('pt','profile','language',      'Idioma'),
  ('pt','profile','support',       'Ajuda & Suporte'),
  ('pt','member','join_soul_pass', 'Aderir ao Soul Pass'),
  ('pt','member','join_now',       'Aderir Agora'),
  ('pt','member','buy_soul',       'Comprar Soul Tokens'),
  ('pt','member','all_series',     'Todas as séries originais'),
  ('pt','member','monthly',        'Mensal'),
  ('pt','member','annual',         'Anual'),
  ('pt','member','get_monthly',    'Obter Mensal'),
  ('pt','member','get_annual',     'Obter Anual')
ON CONFLICT (language_code, namespace, key) DO NOTHING;

-- ─── MIGRATION 009: season_number ─────────────────────────────────────────────
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS season_number INTEGER NOT NULL DEFAULT 1;

-- ─── MIGRATION 011: atomic view counter ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_episode_views(ep_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.episodes
  SET views = COALESCE(views, 0) + 1
  WHERE id = ep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration 012: Create daily_rewards table + fix soul token function signatures
-- Fixes:
--   1. daily_rewards table was missing entirely (referenced in 010 ALTER TABLE)
--   2. deduct_soul_tokens required p_admin_id but engagement.js never passes it
--   3. grant_soul_reward now idempotent with correct column names

-- ─── 1. daily_rewards table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_type TEXT        NOT NULL,
  amount      INTEGER     NOT NULL DEFAULT 0,
  metadata    JSONB,
  rewarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_rewards_reward_type_check CHECK (reward_type IN (
    'daily_login', 'watch_episode', 'share_series', 'complete_episode',
    'first_watch', 'share', 'complete_ep3'
  ))
);

CREATE INDEX IF NOT EXISTS daily_rewards_user_type_idx ON public.daily_rewards (user_id, reward_type, rewarded_at);

ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own rewards" ON public.daily_rewards;
CREATE POLICY "Users read own rewards" ON public.daily_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (used by Express via supabaseAdmin) bypasses RLS automatically.

-- ─── 2. grant_soul_reward (create or replace) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_soul_reward(
  p_user_id  UUID,
  p_type     TEXT,
  p_amount   INTEGER,
  p_metadata JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO public.daily_rewards (user_id, reward_type, amount, metadata)
  VALUES (p_user_id, p_type, p_amount, p_metadata);

  UPDATE public.profiles
  SET soul_balance = soul_balance + p_amount
  WHERE id = p_user_id
  RETURNING soul_balance INTO v_new_balance;

  RETURN COALESCE(v_new_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. Make deduct_soul_tokens p_admin_id optional ──────────────────────────
-- engagement.js calls this without p_admin_id; was failing with "required param".
CREATE OR REPLACE FUNCTION public.deduct_soul_tokens(
  p_user_id  UUID,
  p_amount   INTEGER,
  p_reason   TEXT,
  p_admin_id UUID DEFAULT NULL
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

  RETURN COALESCE(new_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. Make grant_soul_tokens p_admin_id optional too ───────────────────────
CREATE OR REPLACE FUNCTION public.grant_soul_tokens(
  p_user_id  UUID,
  p_amount   INTEGER,
  p_reason   TEXT,
  p_admin_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE public.profiles SET soul_balance = soul_balance + p_amount WHERE id = p_user_id
    RETURNING soul_balance INTO new_balance;

  INSERT INTO public.soul_token_transactions (user_id, amount, type, description)
    VALUES (p_user_id, p_amount, 'grant', p_reason);

  RETURN COALESCE(new_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
