import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyInputs, DomainWeights, PenaltyRule, Penalty, ScoreTier } from './types';
import { applyStreakMultiplier } from './scoring';

// Token milestones: streak day -> tokens awarded (fires once at crossing)
const STREAK_TOKEN_MILESTONES: Record<number, number> = {
  7: 1,
  14: 1,
  30: 2,
  90: 3,
};

export function detectTriggeredPenalties(
  inputs: DailyInputs,
  rules: PenaltyRule[],
  customViolations: string[]
): PenaltyRule[] {
  const triggered: PenaltyRule[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.builtin) {
      if (rule.id === 'doom_scroll' && !inputs.noScrollAm) {
        triggered.push(rule);
      } else if (rule.id === 'missed_operator_hour' && !inputs.operatorHour) {
        triggered.push(rule);
      }
    } else {
      // Custom rule: user self-reports via checkbox
      if (customViolations.includes(rule.id)) {
        triggered.push(rule);
      }
    }
  }

  return triggered;
}

export function checkStreakTokenReward(prevStreak: number, newStreak: number): number {
  let tokens = 0;
  for (const [milestoneStr, reward] of Object.entries(STREAK_TOKEN_MILESTONES)) {
    const milestone = Number(milestoneStr);
    // Award tokens exactly when crossing the milestone (prev < milestone <= new)
    if (prevStreak < milestone && newStreak >= milestone) {
      tokens += reward;
    }
  }
  return tokens;
}

export async function applyPenaltyRecovery(
  penalty: Penalty,
  supabaseClient: SupabaseClient
): Promise<{ xpDelta: number; newScore: number; newTier: ScoreTier; newDisciplineScore: number }> {
  // 1. Fetch the daily_log for log_date
  const { data: logData, error: logError } = await supabaseClient
    .from('daily_logs')
    .select('*')
    .eq('user_id', penalty.user_id)
    .eq('date', penalty.log_date)
    .single();

  if (logError || !logData) {
    throw new Error(`Could not find daily log for ${penalty.log_date}`);
  }

  // 2. Add recovery_pts to discipline_score (capped at 100)
  const currentDiscipline = logData.discipline_score ?? 0;
  const newDisciplineScore = Math.min(100, currentDiscipline + penalty.recovery_pts);
  const disciplineDelta = newDisciplineScore - currentDiscipline;

  // 3. Fetch user's domain weights
  const { data: userData, error: userError } = await supabaseClient
    .from('users')
    .select('domain_weights, total_xp, current_streak')
    .eq('id', penalty.user_id)
    .single();

  if (userError || !userData) {
    throw new Error('Could not fetch user data');
  }

  const weights: DomainWeights = userData.domain_weights ?? {
    body: 25, wealth: 25, skill: 20, discipline: 15, presence: 15,
  };

  // 4. Recalculate daily_life_score using stored domain scores + new discipline
  const bodyScore = logData.body_score ?? 0;
  const wealthScore = logData.wealth_score ?? 0;
  const skillScore = logData.skill_score ?? 0;
  const presenceScore = logData.presence_score ?? 0;

  const newDailyScore =
    (bodyScore * weights.body) / 100 +
    (wealthScore * weights.wealth) / 100 +
    (skillScore * weights.skill) / 100 +
    (newDisciplineScore * weights.discipline) / 100 +
    (presenceScore * weights.presence) / 100;

  // 5. Recalculate tier
  const newTier: ScoreTier =
    newDailyScore >= 90 ? 'S' :
    newDailyScore >= 75 ? 'A' :
    newDailyScore >= 60 ? 'B' :
    newDailyScore >= 45 ? 'C' : 'D';

  // 6. Recalculate XP for new tier
  const tierBaseXP: Record<ScoreTier, number> = { S: 200, A: 150, B: 100, C: 60, D: 25 };
  const newBaseXP = tierBaseXP[newTier];
  const streak = userData.current_streak ?? 0;
  const newXP = applyStreakMultiplier(newBaseXP, streak);

  const oldXP = logData.xp_awarded ?? 0;
  const xpDelta = Math.max(0, newXP - oldXP);

  // 7. Update daily_log with new scores
  await supabaseClient
    .from('daily_logs')
    .update({
      discipline_score: newDisciplineScore,
      daily_life_score: newDailyScore,
      score_tier: newTier,
      xp_awarded: newXP,
    })
    .eq('id', logData.id);

  // 8. Mark penalty as completed
  await supabaseClient
    .from('penalties')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      score_restored: disciplineDelta,
    })
    .eq('id', penalty.id);

  // 9. Credit XP delta to user
  if (xpDelta > 0) {
    const newTotalXP = (userData.total_xp ?? 0) + xpDelta;
    const newLevel = Math.floor(newTotalXP / 1000) + 1;
    await supabaseClient
      .from('users')
      .update({ total_xp: newTotalXP, level: Math.min(newLevel, 100) })
      .eq('id', penalty.user_id);
  }

  return {
    xpDelta,
    newScore: newDailyScore,
    newTier,
    newDisciplineScore,
  };
}
