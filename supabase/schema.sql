-- LevelUp Life — PostgreSQL Schema
-- Run this in your Supabase SQL editor

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  skill_rep_definition TEXT DEFAULT '1 rep = 1 focused session',
  operator_hour_definition TEXT DEFAULT '6–7am: journaling + planning',
  skill_rep_target INTEGER DEFAULT 3,
  domain_weights JSONB DEFAULT '{"body":25,"wealth":25,"skill":20,"discipline":15,"presence":15}'::jsonb,
  score_target INTEGER DEFAULT 75,
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily logs table
CREATE TABLE IF NOT EXISTS public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Body
  steps INTEGER DEFAULT 0,
  workout_done BOOLEAN DEFAULT false,
  workout_minutes INTEGER DEFAULT 0,
  sleep_hours FLOAT DEFAULT 0,

  -- Wealth
  wealth_minutes INTEGER DEFAULT 0,
  asset_brick BOOLEAN DEFAULT false,
  side_revenue FLOAT DEFAULT 0,

  -- Skill
  skill_minutes INTEGER DEFAULT 0,
  skill_reps INTEGER DEFAULT 0,

  -- Discipline
  operator_hour BOOLEAN DEFAULT false,
  no_scroll_am BOOLEAN DEFAULT false,

  -- Presence
  presence_minutes INTEGER DEFAULT 0,
  family_meal BOOLEAN DEFAULT false,

  -- Computed scores (stored for performance)
  body_score FLOAT,
  wealth_score FLOAT,
  skill_score FLOAT,
  discipline_score FLOAT,
  presence_score FLOAT,
  daily_life_score FLOAT,
  score_tier TEXT CHECK (score_tier IN ('S', 'A', 'B', 'C', 'D')),
  xp_awarded INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Daily logs policies
CREATE POLICY "Users can view own logs"
  ON public.daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON public.daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON public.daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON public.daily_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Function: auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on new auth user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS daily_logs_user_date ON public.daily_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS daily_logs_date ON public.daily_logs(date);
