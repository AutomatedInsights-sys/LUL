-- Migration: Add water tracking
-- Run this in your Supabase SQL editor after existing migrations

-- User water preferences
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS water_unit TEXT DEFAULT 'oz',
  ADD COLUMN IF NOT EXISTS water_bottle_size FLOAT DEFAULT 16,
  ADD COLUMN IF NOT EXISTS water_goal FLOAT DEFAULT 64;

-- Per-day bottle count
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS water_bottles INTEGER DEFAULT 0;
