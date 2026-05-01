-- Fix grant_soul_reward: remove soul_token_transactions insert (wrong column name
-- 'transaction_type' vs actual column 'type'), and add missing reward_type values
-- to the daily_rewards CHECK constraint.

-- 1. Extend daily_rewards CHECK to allow all reward types used by the app
ALTER TABLE public.daily_rewards
  DROP CONSTRAINT IF EXISTS daily_rewards_reward_type_check;

ALTER TABLE public.daily_rewards
  ADD CONSTRAINT daily_rewards_reward_type_check
  CHECK (reward_type IN (
    'daily_login',
    'watch_episode',
    'share_series',
    'complete_episode',
    'first_watch',
    'share',
    'complete_ep3'
  ));

-- 2. Replace grant_soul_reward — only touches daily_rewards + profiles (no soul_token_transactions)
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

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
