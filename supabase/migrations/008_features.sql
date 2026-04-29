-- SPHYNX MOTION · Feature Tables
-- watchlist, echo_votes, daily_rewards, creators, episode_progress

-- ─── WATCHLIST ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id  UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, series_id)
);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_own" ON public.watchlist FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── EPISODE PROGRESS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episode_progress (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id   UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  watched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);
ALTER TABLE public.episode_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_own" ON public.episode_progress FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_admin" ON public.episode_progress FOR SELECT USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── ECHO VOTES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.echo_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id  UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  choice_idx  SMALLINT NOT NULL,
  soul_spent  INTEGER NOT NULL DEFAULT 15,
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);
ALTER TABLE public.echo_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "echo_own"   ON public.echo_votes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "echo_public_read" ON public.echo_votes FOR SELECT USING (TRUE);

-- Vote tallies per choice per episode (public read)
CREATE OR REPLACE VIEW public.echo_vote_counts AS
  SELECT episode_id, choice_idx, COUNT(*) AS votes
  FROM public.echo_votes
  GROUP BY episode_id, choice_idx;

-- ─── DAILY REWARDS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('daily_login','watch_episode','share_series','complete_episode')),
  amount      INTEGER NOT NULL DEFAULT 0,
  metadata    JSONB,
  rewarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_own"   ON public.daily_rewards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rewards_admin" ON public.daily_rewards FOR ALL   USING (public.get_my_role() IN ('admin','superadmin'));

-- daily_login tracked in application logic (one per day enforced server-side)

-- ─── CREATORS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creators (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  banner_url      TEXT,
  country         TEXT,
  revenue_share   NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  total_earnings  NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_method   TEXT,
  payout_details  JSONB,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES auth.users(id)
);
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_own"   ON public.creators FOR SELECT USING (id = auth.uid());
CREATE POLICY "creator_admin" ON public.creators FOR ALL    USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── SOUL REWARD FUNCTION ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_soul_reward(
  p_user_id    UUID,
  p_type       TEXT,
  p_amount     INTEGER,
  p_metadata   JSONB DEFAULT NULL
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

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS watchlist_user_idx       ON public.watchlist (user_id);
CREATE INDEX IF NOT EXISTS progress_user_idx        ON public.episode_progress (user_id);
CREATE INDEX IF NOT EXISTS echo_votes_episode_idx   ON public.echo_votes (episode_id);
CREATE INDEX IF NOT EXISTS daily_rewards_user_idx   ON public.daily_rewards (user_id, rewarded_at DESC);
