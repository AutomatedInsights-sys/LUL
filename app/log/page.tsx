'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDailyScore, applyStreakMultiplier } from '@/lib/scoring';
import { DailyInputs, DomainWeights, User, DailyLog, JournalEntry, PenaltyRule } from '@/lib/types';
import { detectTriggeredPenalties, checkStreakTokenReward } from '@/lib/penalties';
import { todayISO, tierBgColor } from '@/lib/utils';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import ScoreRing from '@/components/ui/ScoreRing';
import { useRouter } from 'next/navigation';
import { format, subDays, addDays, parseISO } from 'date-fns';

const DEFAULT_WEIGHTS: DomainWeights = { body: 25, wealth: 25, skill: 20, discipline: 15, presence: 15 };

const DEFAULT_INPUTS: DailyInputs = {
  steps: 0, workoutDone: false, workoutMinutes: 0, sleepHours: 7,
  wealthMinutes: 0, assetBrick: false, sideRevenue: 0,
  skillMinutes: 0, skillReps: 0, skillRepTarget: 3,
  operatorHour: false, noScrollAm: false,
  presenceMinutes: 0, familyMeal: false,
  waterBottles: 0,
};

function TimerButton({ label, onLog }: { label: string; onLog: (minutes: number) => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onLog(Math.floor(elapsed / 60));
    setElapsed(0);
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <button
      type="button"
      onClick={running ? stop : start}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        running
          ? 'bg-teal-500/20 border border-teal-500/50 text-teal-400'
          : 'bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30'
      }`}
    >
      {running ? (
        <>
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} — Tap to log
        </>
      ) : (
        <>▶ {label}</>
      )}
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className="toggle"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function NumberInput({
  value, onChange, min = 0, max, step = 1, placeholder,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder || '0'}
      className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
    />
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1A1A3A] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

const DEFAULT_JOURNAL: JournalEntry = {
  day_win: null,
  went_well: '',
  could_improve: '',
  tomorrow_focus: '',
};

export default function LogPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [inputs, setInputs] = useState<DailyInputs>(DEFAULT_INPUTS);
  const [weights, setWeights] = useState<DomainWeights>(DEFAULT_WEIGHTS);
  const [journal, setJournal] = useState<JournalEntry>(DEFAULT_JOURNAL);
  const [existingLog, setExistingLog] = useState<DailyLog | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveScore, setLiveScore] = useState(() => calculateDailyScore(DEFAULT_INPUTS, DEFAULT_WEIGHTS));
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);
  const [customViolations, setCustomViolations] = useState<string[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [streakToast, setStreakToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const today = todayISO();
  const isToday = selectedDate === today;
  const minDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const canGoBack = selectedDate > minDate;
  const canGoForward = selectedDate < today;

  const userRef = useRef<User | null>(null);

  function changeDate(newDate: string) {
    setSelectedDate(newDate);
    setInputs({ ...DEFAULT_INPUTS, skillRepTarget: userRef.current?.skill_rep_target || 3 });
    setJournal(DEFAULT_JOURNAL);
    setExistingLog(null);
    setSubmitted(false);
    setCustomViolations([]);
  }

  // Load user profile once
  useEffect(() => {
    async function loadProfile() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile as User);
        userRef.current = profile as User;
        const w = profile.domain_weights || DEFAULT_WEIGHTS;
        setWeights(w);
        setPenaltyRules(profile.penalty_rules ?? [
          { id: 'doom_scroll', rule_label: 'Doom Scrolled AM', penalty_text: '10 pushups', recovery_pts: 30, enabled: true, builtin: true },
          { id: 'missed_operator_hour', rule_label: 'Missed Operator Hour', penalty_text: '+20 min skill work', recovery_pts: 30, enabled: true, builtin: true },
        ]);
        setTokenCount(profile.penalty_tokens ?? 3);
        setInputs((prev) => ({ ...prev, skillRepTarget: profile.skill_rep_target || 3 }));
      }
    }
    loadProfile();
  }, [router]);

  // Load log for selected date
  useEffect(() => {
    async function loadLog() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: log } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (log) {
        setExistingLog(log as DailyLog);
        const rep_target = userRef.current?.skill_rep_target || 3;
        const restored: DailyInputs = {
          steps: log.steps ?? 0,
          workoutDone: log.workout_done ?? false,
          workoutMinutes: log.workout_minutes ?? 0,
          sleepHours: log.sleep_hours ?? 7,
          wealthMinutes: log.wealth_minutes ?? 0,
          assetBrick: log.asset_brick ?? false,
          sideRevenue: log.side_revenue ?? 0,
          skillMinutes: log.skill_minutes ?? 0,
          skillReps: log.skill_reps ?? 0,
          skillRepTarget: rep_target,
          operatorHour: log.operator_hour ?? false,
          noScrollAm: log.no_scroll_am ?? false,
          presenceMinutes: log.presence_minutes ?? 0,
          familyMeal: log.family_meal ?? false,
          waterBottles: log.water_bottles ?? 0,
        };
        setInputs(restored);
        setJournal({
          day_win: log.day_win ?? null,
          went_well: log.went_well ?? '',
          could_improve: log.could_improve ?? '',
          tomorrow_focus: log.tomorrow_focus ?? '',
        });
        setSubmitted(true);
      }
    }
    loadLog();
  }, [selectedDate]);

  useEffect(() => {
    setLiveScore(calculateDailyScore(inputs, weights));
  }, [inputs, weights]);

  const update = useCallback(<K extends keyof DailyInputs>(key: K, value: DailyInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (submitted) setSubmitted(false);
  }, [submitted]);

  const updateJournal = useCallback(<K extends keyof JournalEntry>(key: K, value: JournalEntry[K]) => {
    setJournal((prev) => ({ ...prev, [key]: value }));
    if (submitted) setSubmitted(false);
  }, [submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const score = calculateDailyScore(inputs, weights);
    const finalXP = applyStreakMultiplier(score.baseXP, user?.current_streak ?? 0);

    const logData = {
      user_id: authUser.id,
      date: selectedDate,
      steps: inputs.steps,
      workout_done: inputs.workoutDone,
      workout_minutes: inputs.workoutMinutes,
      sleep_hours: inputs.sleepHours,
      wealth_minutes: inputs.wealthMinutes,
      asset_brick: inputs.assetBrick,
      side_revenue: inputs.sideRevenue,
      skill_minutes: inputs.skillMinutes,
      skill_reps: inputs.skillReps,
      operator_hour: inputs.operatorHour,
      no_scroll_am: inputs.noScrollAm,
      presence_minutes: inputs.presenceMinutes,
      family_meal: inputs.familyMeal,
      water_bottles: inputs.waterBottles,
      body_score: score.body,
      wealth_score: score.wealth,
      skill_score: score.skill,
      discipline_score: score.discipline,
      presence_score: score.presence,
      daily_life_score: score.daily,
      score_tier: score.tier,
      xp_awarded: finalXP,
      // Journal
      day_win: journal.day_win,
      went_well: journal.went_well || null,
      could_improve: journal.could_improve || null,
      tomorrow_focus: journal.tomorrow_focus || null,
    };

    if (existingLog) {
      await supabase.from('daily_logs').update(logData).eq('id', existingLog.id);
    } else {
      const { data: inserted } = await supabase.from('daily_logs').insert(logData).select().single();
      if (inserted) setExistingLog(inserted as DailyLog);

      // Update user XP, streak, level
      const prevStreak = user?.current_streak ?? 0;
      const newXP = (user?.total_xp ?? 0) + finalXP;
      const newStreak = score.daily >= 45 ? prevStreak + 1 : 0;
      const newLevel = Math.min(100, Math.floor(newXP / 1000) + 1);
      const newLongest = Math.max(user?.longest_streak ?? 0, newStreak);

      // Check for streak milestone token rewards
      const tokenBonus = checkStreakTokenReward(prevStreak, newStreak);
      const newTokens = tokenBonus > 0 ? Math.min(10, tokenCount + tokenBonus) : tokenCount;

      const userUpdate: Record<string, unknown> = {
        total_xp: newXP,
        current_streak: newStreak,
        longest_streak: newLongest,
        level: newLevel,
      };
      if (tokenBonus > 0) {
        userUpdate.penalty_tokens = newTokens;
      }

      await supabase.from('users').update(userUpdate).eq('id', authUser.id);

      if (tokenBonus > 0) {
        setTokenCount(newTokens);
        setStreakToast(`🪙 +${tokenBonus} token${tokenBonus > 1 ? 's' : ''} earned for ${newStreak}-day streak!`);
        setTimeout(() => setStreakToast(null), 4000);
      }

      setUser((prev) => prev ? {
        ...prev,
        total_xp: newXP,
        current_streak: newStreak,
        longest_streak: newLongest,
        level: newLevel,
        penalty_tokens: newTokens,
      } : prev);
    }

    // Upsert penalties for triggered violations (never double-insert)
    const triggered = detectTriggeredPenalties(inputs, penaltyRules, customViolations);
    for (const rule of triggered) {
      await supabase.from('penalties').upsert(
        {
          user_id: authUser.id,
          log_date: selectedDate,
          rule_id: rule.id,
          rule_label: rule.rule_label,
          penalty_text: rule.penalty_text,
          recovery_pts: rule.recovery_pts,
        },
        { onConflict: 'user_id,log_date,rule_id', ignoreDuplicates: true }
      );
    }

    setSubmitted(true);
    setSaving(false);
  }

  const scoreResult = liveScore;

  const DOMAIN_SECTIONS = [
    {
      id: 'body',
      icon: '🔥',
      label: 'Body',
      color: '#FF6B6B',
      score: scoreResult.body,
      fields: (
        <>
          <FieldRow label="Steps" hint="10,000 = full score">
            <div className="w-28">
              <NumberInput value={inputs.steps} onChange={(v) => update('steps', v)} max={50000} placeholder="8000" />
            </div>
          </FieldRow>
          <FieldRow label="Sleep" hint={`${inputs.sleepHours}h`}>
            <div className="w-36 flex flex-col gap-1">
              <input
                type="range"
                min={4} max={10} step={0.5}
                value={inputs.sleepHours}
                onChange={(e) => update('sleepHours', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-600">
                <span>4h</span><span>10h</span>
              </div>
            </div>
          </FieldRow>
          <FieldRow label="Workout" hint={inputs.workoutDone ? `${inputs.workoutMinutes} min` : undefined}>
            <Toggle value={inputs.workoutDone} onChange={(v) => update('workoutDone', v)} />
          </FieldRow>
          {inputs.workoutDone && (
            <FieldRow label="Workout Minutes" hint="30 min = full score">
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <NumberInput value={inputs.workoutMinutes} onChange={(v) => update('workoutMinutes', v)} max={300} />
                </div>
              </div>
            </FieldRow>
          )}
        </>
      ),
    },
    {
      id: 'wealth',
      icon: '💰',
      label: 'Wealth',
      color: '#FFD93D',
      score: scoreResult.wealth,
      fields: (
        <>
          <FieldRow label="Wealth Build Minutes" hint="60 min = full score">
            <div className="flex items-center gap-2">
              <div className="w-20">
                <NumberInput value={inputs.wealthMinutes} onChange={(v) => update('wealthMinutes', v)} max={480} />
              </div>
              <TimerButton label="Timer" onLog={(m) => update('wealthMinutes', inputs.wealthMinutes + m)} />
            </div>
          </FieldRow>
          <FieldRow label="Asset Brick" hint="One concrete step to build an asset">
            <Toggle value={inputs.assetBrick} onChange={(v) => update('assetBrick', v)} />
          </FieldRow>
          <FieldRow label="Side Revenue ($)" hint="$0 still earns 5 pts">
            <div className="w-28">
              <NumberInput value={inputs.sideRevenue} onChange={(v) => update('sideRevenue', v)} step={1} placeholder="0" />
            </div>
          </FieldRow>
        </>
      ),
    },
    {
      id: 'skill',
      icon: '⚡',
      label: 'Skill',
      color: '#6BCB77',
      score: scoreResult.skill,
      fields: (
        <>
          <FieldRow label="Skill Minutes" hint="45 min = full score">
            <div className="flex items-center gap-2">
              <div className="w-20">
                <NumberInput value={inputs.skillMinutes} onChange={(v) => update('skillMinutes', v)} max={480} />
              </div>
              <TimerButton label="Timer" onLog={(m) => update('skillMinutes', inputs.skillMinutes + m)} />
            </div>
          </FieldRow>
          <FieldRow
            label="Skill Reps"
            hint={user?.skill_rep_definition || '1 rep = 1 session'}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => update('skillReps', Math.max(0, inputs.skillReps - 1))}
                className="w-8 h-8 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-lg font-bold flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold text-violet-400">{inputs.skillReps}</span>
              <button
                type="button"
                onClick={() => update('skillReps', inputs.skillReps + 1)}
                className="w-8 h-8 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-lg font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </FieldRow>
        </>
      ),
    },
    {
      id: 'discipline',
      icon: '🛡️',
      label: 'Discipline',
      color: '#4D96FF',
      score: scoreResult.discipline,
      fields: (
        <>
          <FieldRow
            label="Operator Hour Done"
            hint={user?.operator_hour_definition || '6–7am focus block'}
          >
            <Toggle value={inputs.operatorHour} onChange={(v) => update('operatorHour', v)} />
          </FieldRow>
          <FieldRow label="No-Scroll AM" hint="Avoided social media first hour after waking">
            <Toggle value={inputs.noScrollAm} onChange={(v) => update('noScrollAm', v)} />
          </FieldRow>
        </>
      ),
    },
    {
      id: 'presence',
      icon: '❤️',
      label: 'Presence',
      color: '#FF6FC8',
      score: scoreResult.presence,
      fields: (
        <>
          <FieldRow label="Presence Minutes" hint="60 min phone-down = full score">
            <div className="w-28">
              <NumberInput value={inputs.presenceMinutes} onChange={(v) => update('presenceMinutes', v)} max={480} />
            </div>
          </FieldRow>
          <FieldRow label="Family Meal" hint="Shared a meal with family today">
            <Toggle value={inputs.familyMeal} onChange={(v) => update('familyMeal', v)} />
          </FieldRow>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />
      {streakToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-bounce">
          {streakToast}
        </div>
      )}
      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header with date picker */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Daily Log</h1>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => canGoBack && changeDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                disabled={!canGoBack}
                className="w-8 h-8 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  {format(parseISO(selectedDate), 'EEEE, MMMM d')}
                </p>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => changeDate(today)}
                    className="text-xs text-violet-400 hover:text-violet-300 mt-0.5 transition-colors"
                  >
                    Back to today
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => canGoForward && changeDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                disabled={!canGoForward}
                className="w-8 h-8 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
            </div>
          </div>

          {/* Live Score Preview */}
          <Card className="mb-6 flex items-center gap-6" glow="purple">
            <ScoreRing
              score={scoreResult.daily}
              size={100}
              strokeWidth={8}
              label="Daily Score"
              sublabel={scoreResult.tier}
              animate
            />
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-2">
                {['body', 'wealth', 'skill', 'discipline', 'presence'].map((d, i) => {
                  const scores = [scoreResult.body, scoreResult.wealth, scoreResult.skill, scoreResult.discipline, scoreResult.presence];
                  const icons = ['🔥', '💰', '⚡', '🛡️', '❤️'];
                  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FC8'];
                  return (
                    <div key={d} className="text-center">
                      <div className="text-sm mb-1">{icons[i]}</div>
                      <div className="text-sm font-bold" style={{ color: colors[i] }}>
                        {Math.round(scores[i])}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3">
                <span className={`text-xs px-2 py-1 rounded-full border ${tierBgColor(scoreResult.tier)}`}>
                  {scoreResult.tier} Tier — {scoreResult.baseXP} XP base
                </span>
              </div>
            </div>
          </Card>

          {/* Log Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {DOMAIN_SECTIONS.map((section) => (
              <Card key={section.id} className="overflow-hidden !p-0">
                {/* Domain header */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E3F]"
                  style={{ borderLeftColor: section.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.icon}</span>
                    <span className="font-semibold text-white">{section.label}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: section.color }}>
                    {Math.round(section.score)}/100
                  </span>
                </div>
                {/* Fields */}
                <div className="px-4 py-1">{section.fields}</div>
              </Card>
            ))}

            {/* Water Tracker */}
            {(() => {
              const bottleSize = user?.water_bottle_size ?? 16;
              const waterGoal = user?.water_goal ?? 64;
              const unit = user?.water_unit ?? 'oz';
              const goalBottles = Math.ceil(waterGoal / bottleSize);
              const displayCount = Math.min(goalBottles, 10);
              const consumed = inputs.waterBottles * bottleSize;
              const pct = Math.min(100, Math.round((consumed / waterGoal) * 100));

              return (
                <Card className="overflow-hidden !p-0">
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E3F]"
                    style={{ borderLeftColor: '#60A5FA', borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💧</span>
                      <span className="font-semibold text-white">Water</span>
                    </div>
                    <span className="text-sm font-bold text-blue-400">
                      {Math.round(consumed)}/{Math.round(waterGoal)} {unit}
                    </span>
                  </div>

                  <div className="px-4 py-4">
                    {/* Bottle grid — tap to fill up to that bottle */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {Array.from({ length: displayCount }).map((_, i) => {
                        const filled = i < inputs.waterBottles;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              update('waterBottles', filled && i === inputs.waterBottles - 1
                                ? inputs.waterBottles - 1
                                : i + 1)
                            }
                            className={`text-2xl transition-all leading-none ${filled ? '' : 'opacity-25 grayscale'}`}
                            title={`${i + 1} bottle${i + 1 !== 1 ? 's' : ''} (${Math.round((i + 1) * bottleSize)} ${unit})`}
                          >
                            🫙
                          </button>
                        );
                      })}
                      {goalBottles > 10 && (
                        <span className="text-xs text-slate-500 self-center">
                          +{goalBottles - 10} more to goal
                        </span>
                      )}
                    </div>

                    {/* +/- controls */}
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => update('waterBottles', Math.max(0, inputs.waterBottles - 1))}
                        className="w-9 h-9 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-lg font-bold flex items-center justify-center transition-colors"
                      >
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <p className="text-sm font-semibold text-white">
                          {inputs.waterBottles} / {goalBottles} bottle{goalBottles !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-500">{bottleSize} {unit} each</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('waterBottles', inputs.waterBottles + 1)}
                        className="w-9 h-9 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-lg font-bold flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-[#1E1E3F] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? '#34D399' : '#60A5FA',
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 text-right">{pct}% of daily goal</p>
                  </div>
                </Card>
              );
            })()}

            {/* Rule Violations */}
            {(() => {
              const builtinTriggered = penaltyRules.filter(
                (r) => r.enabled && r.builtin && (
                  (r.id === 'doom_scroll' && !inputs.noScrollAm) ||
                  (r.id === 'missed_operator_hour' && !inputs.operatorHour)
                )
              );
              const customRules = penaltyRules.filter((r) => r.enabled && !r.builtin);
              if (builtinTriggered.length === 0 && customRules.length === 0) return null;
              return (
                <Card className="overflow-hidden !p-0">
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E3F]"
                    style={{ borderLeftColor: '#F59E0B', borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span className="font-semibold text-white">Rule Violations</span>
                    </div>
                    <span className="text-xs text-amber-400">🪙 {tokenCount} token{tokenCount !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {builtinTriggered.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Auto-detected</p>
                        {builtinTriggered.map((rule) => (
                          <div key={rule.id} className="flex items-center justify-between gap-3 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-red-300">🚫 {rule.rule_label}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Penalty: {rule.penalty_text} · +{rule.recovery_pts} pts back if redeemed
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {customRules.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Custom rules — did you break any?</p>
                        {customRules.map((rule) => (
                          <label key={rule.id} className="flex items-center gap-3 bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-3 py-2 cursor-pointer hover:border-amber-500/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={customViolations.includes(rule.id)}
                              onChange={(e) => {
                                setCustomViolations((prev) =>
                                  e.target.checked ? [...prev, rule.id] : prev.filter((id) => id !== rule.id)
                                );
                              }}
                              className="w-4 h-4 accent-amber-500"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-300">{rule.rule_label}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {rule.penalty_text} · +{rule.recovery_pts} pts back if redeemed
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-slate-600">
                      Completing a penalty with a token restores points to your score. You have {tokenCount} token{tokenCount !== 1 ? 's' : ''} remaining.
                    </p>
                  </div>
                </Card>
              );
            })()}

            {/* Journal */}
            <Card className="overflow-hidden !p-0">
              <div
                className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E3F]"
                style={{ borderLeftColor: '#A78BFA', borderLeftWidth: 3 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📓</span>
                  <span className="font-semibold text-white">Daily Journal</span>
                </div>
                <span className="text-xs text-slate-500">Optional — 60-second reflection</span>
              </div>

              <div className="px-4 py-4 space-y-5">
                {/* Win / Loss */}
                <div>
                  <p className="text-sm font-medium text-slate-200 mb-3">Was today a win?</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => updateJournal('day_win', journal.day_win === true ? null : true)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                        journal.day_win === true
                          ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                          : 'bg-transparent border-[#2D2D5E] text-slate-500 hover:border-teal-500/50 hover:text-teal-400'
                      }`}
                    >
                      <span className="text-xl">🏆</span> Win
                    </button>
                    <button
                      type="button"
                      onClick={() => updateJournal('day_win', journal.day_win === false ? null : false)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                        journal.day_win === false
                          ? 'bg-red-500/20 border-red-500 text-red-300'
                          : 'bg-transparent border-[#2D2D5E] text-slate-500 hover:border-red-500/50 hover:text-red-400'
                      }`}
                    >
                      <span className="text-xl">📉</span> Loss
                    </button>
                  </div>
                </div>

                {/* What went well */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1.5">
                    What went well today?
                  </label>
                  <textarea
                    value={journal.went_well}
                    onChange={(e) => updateJournal('went_well', e.target.value)}
                    rows={2}
                    placeholder="The morning block was locked in. Nailed the workout early..."
                    className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>

                {/* What could have been better */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1.5">
                    What could I have done better?
                  </label>
                  <textarea
                    value={journal.could_improve}
                    onChange={(e) => updateJournal('could_improve', e.target.value)}
                    rows={2}
                    placeholder="Scrolled too long after lunch. Skipped the second skill session..."
                    className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>

                {/* Tomorrow's focus */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1.5">
                    Focus for tomorrow
                  </label>
                  <textarea
                    value={journal.tomorrow_focus}
                    onChange={(e) => updateJournal('tomorrow_focus', e.target.value)}
                    rows={2}
                    placeholder="Close the Acme deal. Hit 10k steps before noon. No phone until 9am..."
                    className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
                submitted
                  ? 'bg-teal-600 hover:bg-teal-500'
                  : 'bg-violet-600 hover:bg-violet-500'
              } text-white disabled:opacity-50 shadow-lg`}
            >
              {saving
                ? 'Saving...'
                : submitted
                ? `✓ Logged — Score ${Math.round(scoreResult.daily)} (update)`
                : `Submit Day — ${Math.round(scoreResult.daily)} pts`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
