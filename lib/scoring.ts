import { DailyInputs, DomainWeights, ScoreResult, ScoreTier } from './types';

export function scoreBody(inputs: DailyInputs): number {
  const stepsScore = Math.min(30, (inputs.steps / 10000) * 30);

  let sleepScore = 0;
  if (inputs.sleepHours >= 7 && inputs.sleepHours <= 8) sleepScore = 40;
  else if (inputs.sleepHours >= 6) sleepScore = 25;
  else if (inputs.sleepHours >= 5) sleepScore = 10;
  else sleepScore = 0;

  let workoutScore = 0;
  if (inputs.workoutDone) {
    workoutScore = 20;
    if (inputs.workoutMinutes >= 30) workoutScore = 30;
    else if (inputs.workoutMinutes >= 15) workoutScore = 25;
  }

  return Math.min(100, stepsScore + sleepScore + workoutScore);
}

export function scoreWealth(inputs: DailyInputs): number {
  const minutesScore = Math.min(50, (inputs.wealthMinutes / 60) * 50);
  const brickScore = inputs.assetBrick ? 30 : 0;
  const revenueScore =
    inputs.sideRevenue === undefined
      ? 0
      : inputs.sideRevenue === 0
      ? 5
      : Math.min(20, 5 + (inputs.sideRevenue / 100) * 15);
  return Math.min(100, minutesScore + brickScore + revenueScore);
}

export function scoreSkill(inputs: DailyInputs): number {
  const minutesScore = Math.min(60, (inputs.skillMinutes / 45) * 60);
  const repsScore =
    inputs.skillRepTarget > 0
      ? Math.min(40, (inputs.skillReps / inputs.skillRepTarget) * 40)
      : 0;
  return Math.min(100, minutesScore + repsScore);
}

export function scoreDiscipline(inputs: DailyInputs): number {
  return (inputs.operatorHour ? 50 : 0) + (inputs.noScrollAm ? 50 : 0);
}

export function scorePresence(inputs: DailyInputs): number {
  const minutesScore = Math.min(70, (inputs.presenceMinutes / 60) * 70);
  const mealScore = inputs.familyMeal ? 30 : 0;
  return Math.min(100, minutesScore + mealScore);
}

export function calculateDailyScore(
  inputs: DailyInputs,
  weights: DomainWeights
): ScoreResult {
  const body = scoreBody(inputs);
  const wealth = scoreWealth(inputs);
  const skill = scoreSkill(inputs);
  const discipline = scoreDiscipline(inputs);
  const presence = scorePresence(inputs);

  const daily =
    (body * weights.body) / 100 +
    (wealth * weights.wealth) / 100 +
    (skill * weights.skill) / 100 +
    (discipline * weights.discipline) / 100 +
    (presence * weights.presence) / 100;

  const tier: ScoreTier =
    daily >= 90 ? 'S' : daily >= 75 ? 'A' : daily >= 60 ? 'B' : daily >= 45 ? 'C' : 'D';

  const baseXP: Record<ScoreTier, number> = { S: 200, A: 150, B: 100, C: 60, D: 25 };

  return { body, wealth, skill, discipline, presence, daily, tier, baseXP: baseXP[tier] };
}

export function applyStreakMultiplier(baseXP: number, streak: number): number {
  if (streak >= 90) return Math.round(baseXP * 3.0);
  if (streak >= 30) return Math.round(baseXP * 2.0);
  if (streak >= 14) return Math.round(baseXP * 1.5);
  if (streak >= 7) return Math.round(baseXP * 1.25);
  return baseXP;
}

export function getStreakMultiplierLabel(streak: number): string {
  if (streak >= 90) return '3.0×';
  if (streak >= 30) return '2.0×';
  if (streak >= 14) return '1.5×';
  if (streak >= 7) return '1.25×';
  return '1×';
}

export const DEFAULT_WEIGHTS: DomainWeights = {
  body: 25,
  wealth: 25,
  skill: 20,
  discipline: 15,
  presence: 15,
};

export function xpToLevel(totalXp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  const level = Math.floor(totalXp / 1000) + 1;
  const xpIntoLevel = totalXp % 1000;
  const xpForNext = 1000;
  return { level: Math.min(level, 100), xpIntoLevel, xpForNext };
}

export function getTierColor(tier: ScoreTier): string {
  const colors: Record<ScoreTier, string> = {
    S: '#FFD700',
    A: '#FF6B35',
    B: '#6C63FF',
    C: '#00C9A7',
    D: '#8892A4',
  };
  return colors[tier];
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#FFD700';
  if (score >= 75) return '#FF6B35';
  if (score >= 60) return '#6C63FF';
  if (score >= 45) return '#00C9A7';
  return '#8892A4';
}
