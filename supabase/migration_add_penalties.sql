-- Migration: Add penalty system
-- Run this in your Supabase SQL editor if you already have the base schema

-- Add penalty columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS penalty_rules JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS penalty_tokens INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS penalty_tokens_spent INTEGER DEFAULT 0;

-- Create penalties table
CREATE TABLE IF NOT EXISTS public.penalties (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date       DATE NOT NULL,
  rule_id        TEXT NOT NULL,
  rule_label     TEXT NOT NULL,
  penalty_text   TEXT NOT NULL,
  recovery_pts   FLOAT NOT NULL DEFAULT 0,
  token_used     BOOLEAN DEFAULT FALSE,
  completed      BOOLEAN DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  score_restored FLOAT,
  dismissed      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date, rule_id)
);

ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own penalties"
  ON public.penalties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own penalties"
  ON public.penalties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own penalties"
  ON public.penalties FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS penalties_user_date ON public.penalties(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS penalties_user_pending ON public.penalties(user_id, completed) WHERE completed = FALSE;
