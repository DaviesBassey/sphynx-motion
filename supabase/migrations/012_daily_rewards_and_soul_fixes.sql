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
