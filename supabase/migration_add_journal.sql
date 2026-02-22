-- Migration: Add journaling fields to daily_logs
-- Run this in your Supabase SQL editor

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS day_win        BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS went_well      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS could_improve  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tomorrow_focus TEXT DEFAULT NULL;
