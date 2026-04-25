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
