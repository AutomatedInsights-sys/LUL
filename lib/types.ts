export interface PenaltyRule {
  id: string;           // 'doom_scroll' | 'missed_operator_hour' | uuid
  rule_label: string;   // "Doom Scrolled AM"
  penalty_text: string; // "10 pushups"
  recovery_pts: number; // discipline pts restored on completion (max 50)
  enabled: boolean;
  builtin?: boolean;    // true = auto-detected from log toggles
}

export interface Penalty {
  id: string;
  user_id: string;
  log_date: string;
  rule_id: string;
  rule_label: string;
  penalty_text: string;
  recovery_pts: number;
  token_used: boolean;
  completed: boolean;
  completed_at: string | null;
  score_restored: number | null;
  dismissed: boolean;
  created_at: string;
}

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
  penalty_rules: PenaltyRule[] | null;
  penalty_tokens: number;
  penalty_tokens_spent: number;
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
  // Journal
  day_win: boolean | null;
  went_well: string | null;
  could_improve: string | null;
  tomorrow_focus: string | null;
  created_at: string;
}

export interface JournalEntry {
  day_win: boolean | null;
  went_well: string;
  could_improve: string;
  tomorrow_focus: string;
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
