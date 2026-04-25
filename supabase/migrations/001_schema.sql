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
