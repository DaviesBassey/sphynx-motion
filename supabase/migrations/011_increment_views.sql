-- Atomic episode view counter — avoids read-then-write race condition
CREATE OR REPLACE FUNCTION public.increment_episode_views(ep_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.episodes
  SET views = COALESCE(views, 0) + 1
  WHERE id = ep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
