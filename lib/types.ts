export interface User {
  id: string;
  email: string;
  skill_rep_definition: string | null;
  operator_hour_definition: string | null;
  skill_rep_target: number;
  domain_weights: DomainWeights;
  score_target: number;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
}

export interface DomainWeights {
  body: number;
  wealth: number;
  skill: number;
  discipline: number;
  presence: number;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  // Body
  steps: number | null;
  workout_done: boolean;
  workout_minutes: number | null;
  sleep_hours: number | null;
  // Wealth
  wealth_minutes: number | null;
  asset_brick: boolean;
  side_revenue: number | null;
  // Skill
  skill_minutes: number | null;
  skill_reps: number | null;
  // Discipline
  operator_hour: boolean;
  no_scroll_am: boolean;
  // Presence
  presence_minutes: number | null;
  family_meal: boolean;
  // Computed
  body_score: number | null;
  wealth_score: number | null;
  skill_score: number | null;
  discipline_score: number | null;
  presence_score: number | null;
  daily_life_score: number | null;
  score_tier: ScoreTier | null;
  xp_awarded: number | null;
  created_at: string;
}

export type ScoreTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface DailyInputs {
  steps: number;
  workoutDone: boolean;
  workoutMinutes: number;
  sleepHours: number;
  wealthMinutes: number;
  assetBrick: boolean;
  sideRevenue: number;
  skillMinutes: number;
  skillReps: number;
  skillRepTarget: number;
  operatorHour: boolean;
  noScrollAm: boolean;
  presenceMinutes: number;
  familyMeal: boolean;
}

export interface ScoreResult {
  body: number;
  wealth: number;
  skill: number;
  discipline: number;
  presence: number;
  daily: number;
  tier: ScoreTier;
  baseXP: number;
}

export interface AnalyticsPeriod {
  start: Date;
  end: Date;
  logs: DailyLog[];
}

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  S: 'Locked In',
  A: 'On Fire',
  B: 'Solid Day',
  C: 'Showed Up',
  D: 'Rest & Reset',
};

export const DOMAIN_COLORS = {
  body: '#FF6B6B',
  wealth: '#FFD93D',
  skill: '#6BCB77',
  discipline: '#4D96FF',
  presence: '#FF6FC8',
};

export const DOMAIN_ICONS = {
  body: '🔥',
  wealth: '💰',
  skill: '⚡',
  discipline: '🛡️',
  presence: '❤️',
};
