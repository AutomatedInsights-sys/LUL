-- Migration: Add dismissed column to penalties
-- Run this in your Supabase SQL editor (after migration_add_penalties.sql)

ALTER TABLE public.penalties
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;
