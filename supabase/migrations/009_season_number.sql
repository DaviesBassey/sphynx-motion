-- Migration 009: Add season_number to episodes
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS season_number INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.episodes.season_number IS 'Season number, defaults to 1 for single-season series';
