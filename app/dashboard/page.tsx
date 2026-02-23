'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import ScoreRing from '@/components/ui/ScoreRing';
import DomainCard from '@/components/ui/DomainCard';
import { User, DailyLog, SCORE_TIER_LABELS, DOMAIN_ICONS } from '@/lib/types';
import { todayISO, tierBgColor, formatDate } from '@/lib/utils';
import { xpToLevel, getStreakMultiplierLabel } from '@/lib/scoring';
import Link from 'next/link';
import { format, subDays } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [pendingPenaltyCount, setPendingPenaltyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = todayISO();

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [{ data: profile }, { data: logs }, { data: pendingPens }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', authUser.id)
          .gte('date', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
          .order('date', { ascending: false }),
        supabase
          .from('penalties')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('completed', false),
      ]);

      if (profile) setUser(profile as User);
      if (logs) {
        setRecentLogs(logs as DailyLog[]);
        const todayEntry = logs.find((l) => l.date === today);
        if (todayEntry) setTodayLog(todayEntry as DailyLog);
      }
      setPendingPenaltyCount(pendingPens?.length ?? 0);
      setLoading(false);
    }
    load();
  }, [router, today]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const xpInfo = xpToLevel(user?.total_xp ?? 0);
  const xpProgress = (xpInfo.xpIntoLevel / xpInfo.xpForNext) * 100;
  const streakMultiplier = getStreakMultiplierLabel(user?.current_streak ?? 0);

  // Sparklines: last 7 days per domain
  const last7 = recentLogs.slice(0, 7).reverse();
  const sparklines = {
    body: last7.map((l) => l.body_score ?? 0),
    wealth: last7.map((l) => l.wealth_score ?? 0),
    skill: last7.map((l) => l.skill_score ?? 0),
    discipline: last7.map((l) => l.discipline_score ?? 0),
    presence: last7.map((l) => l.presence_score ?? 0),
  };

  // Weakest domain today
  let weakestDomain = '';
  if (todayLog) {
    const domains = [
      { name: 'Body', score: todayLog.body_score ?? 0 },
      { name: 'Wealth', score: todayLog.wealth_score ?? 0 },
      { name: 'Skill', score: todayLog.skill_score ?? 0 },
      { name: 'Discipline', score: todayLog.discipline_score ?? 0 },
      { name: 'Presence', score: todayLog.presence_score ?? 0 },
    ];
    weakestDomain = domains.sort((a, b) => a.score - b.score)[0].name;
  }

  // 30-day average
  const scored = recentLogs.filter((l) => l.daily_life_score !== null);
  const avg30 = scored.length
    ? Math.round(scored.reduce((a, l) => a + (l.daily_life_score ?? 0), 0) / scored.length)
    : 0;

  // Yesterday's journal (tomorrow_focus becomes today's mission)
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayLog = recentLogs.find((l) => l.date === yesterday);

  // Win/Loss rate (last 30 days with a verdict)
  const judgedLogs = recentLogs.filter((l) => l.day_win !== null);
  const winCount = judgedLogs.filter((l) => l.day_win === true).length;
  const winRate = judgedLogs.length ? Math.round((winCount / judgedLogs.length) * 100) : null;

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />
      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {!todayLog && (
              <Link
                href="/log"
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors animate-pulse"
              >
                Log Today →
              </Link>
            )}
            {todayLog && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/agent?date=${todayLog.date}`}
                  className="border border-violet-500/40 text-violet-400 text-sm px-3 py-2 rounded-lg hover:bg-violet-500/10 transition-colors flex items-center gap-1.5"
                >
                  ✨ Share
                </Link>
                <Link
                  href="/log"
                  className="border border-teal-500/40 text-teal-400 text-sm px-3 py-2 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  ✓ Logged
                </Link>
              </div>
            )}
          </div>

          {/* Main score + stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Score ring */}
            <Card glow={todayLog ? 'purple' : 'none'} className="flex flex-col items-center justify-center py-4 md:col-span-1">
              {todayLog ? (
                <>
                  <ScoreRing
                    score={todayLog.daily_life_score ?? 0}
                    size={140}
                    strokeWidth={10}
                    label="Today's Score"
                    sublabel={todayLog.score_tier ?? undefined}
                    animate
                  />
                  <span className={`mt-3 text-xs px-3 py-1 rounded-full border ${tierBgColor(todayLog.score_tier ?? 'D')}`}>
                    {SCORE_TIER_LABELS[todayLog.score_tier as keyof typeof SCORE_TIER_LABELS] ?? '—'}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-[100px] h-[100px] rounded-full border-[8px] border-[#1E1E3F] flex items-center justify-center">
                    <span className="text-3xl text-slate-600">?</span>
                  </div>
                  <p className="text-sm text-slate-500 text-center">Not logged yet</p>
                  <Link href="/log" className="text-xs text-violet-400 hover:text-violet-300">
                    Log now →
                  </Link>
                </div>
              )}
            </Card>

            {/* Stats */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <Card className="flex flex-col gap-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Streak</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-orange-400 streak-flame">
                    {user?.current_streak ?? 0}
                  </span>
                  <span className="text-slate-400 text-sm mb-1">days 🔥</span>
                </div>
                <p className="text-xs text-slate-500">
                  Multiplier: {streakMultiplier} · Best: {user?.longest_streak ?? 0}d
                </p>
              </Card>

              <Card className="flex flex-col gap-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Level</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-violet-400">{xpInfo.level}</span>
                  <span className="text-slate-400 text-sm mb-1">/ 100</span>
                </div>
                <div className="h-1.5 bg-[#1E1E3F] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full xp-bar-fill rounded-full transition-all duration-1000"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {xpInfo.xpIntoLevel.toLocaleString()} / {xpInfo.xpForNext.toLocaleString()} XP
                </p>
              </Card>

              <Card className="flex flex-col gap-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total XP</p>
                <span className="text-2xl font-bold text-teal-400">
                  {(user?.total_xp ?? 0).toLocaleString()}
                </span>
                <p className="text-xs text-slate-500">
                  {todayLog?.xp_awarded ? `+${todayLog.xp_awarded} today` : 'Log today to earn XP'}
                </p>
              </Card>

              <Card className="flex flex-col gap-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">30-Day Avg</p>
                <span className="text-2xl font-bold text-slate-200">{avg30}</span>
                <p className="text-xs text-slate-500">{scored.length} days logged</p>
              </Card>

              <Card className="flex flex-col gap-1 col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">⚠️ Penalties</p>
                  <span className="text-xs text-amber-400">🪙 {user?.penalty_tokens ?? 0} tokens</span>
                </div>
                {pendingPenaltyCount === 0 ? (
                  <span className="text-xl font-bold text-teal-400">✓ Clean</span>
                ) : (
                  <span className="text-2xl font-bold text-red-400">{pendingPenaltyCount} pending</span>
                )}
                <Link href="/penalties" className="text-xs text-violet-400 hover:text-violet-300 mt-1">
                  View ledger →
                </Link>
              </Card>
            </div>
          </div>

          {/* Domain Insights */}
          {todayLog && (
            <>
              {weakestDomain && (
                <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <p className="text-sm text-yellow-400">
                    ⚡ Today's opportunity: <span className="font-semibold">{weakestDomain}</span> is your lowest domain. Focus here tomorrow.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {(['body', 'wealth', 'skill', 'discipline', 'presence'] as const).map((d) => (
                  <DomainCard
                    key={d}
                    domain={d}
                    score={todayLog[`${d}_score` as keyof DailyLog] as number ?? 0}
                    sparkline={sparklines[d]}
                  />
                ))}
              </div>
            </>
          )}

          {/* Journal panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Today's mission (from yesterday's focus) */}
            <Card className="border-l-[3px] border-l-violet-500">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">📓 Today's Mission</p>
              {yesterdayLog?.tomorrow_focus ? (
                <p className="text-sm text-slate-200 leading-relaxed">
                  "{yesterdayLog.tomorrow_focus}"
                </p>
              ) : (
                <p className="text-sm text-slate-600 italic">
                  No focus set for today.{' '}
                  <Link href="/log" className="text-violet-400 hover:text-violet-300 not-italic">
                    Set one in today's log →
                  </Link>
                </p>
              )}
            </Card>

            {/* Win / Loss rate */}
            <Card className="border-l-[3px] border-l-teal-500">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">🏆 Win Rate (30 days)</p>
              {winRate !== null ? (
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-teal-400">{winRate}%</span>
                  <span className="text-sm text-slate-400 mb-1">
                    {winCount}W / {judgedLogs.length - winCount}L
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-600 italic">
                  Mark days as wins or losses in your{' '}
                  <Link href="/log" className="text-violet-400 hover:text-violet-300 not-italic">
                    daily journal
                  </Link>
                </p>
              )}
              {todayLog?.day_win !== null && todayLog?.day_win !== undefined && (
                <p className="text-xs mt-2">
                  Today:{' '}
                  <span className={todayLog.day_win ? 'text-teal-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {todayLog.day_win ? '🏆 Win' : '📉 Loss'}
                  </span>
                </p>
              )}
            </Card>
          </div>

          {/* Yesterday's reflection (if they wrote something) */}
          {yesterdayLog?.could_improve && (
            <div className="mb-4 bg-[#12122A] border border-[#1E1E3F] border-l-[3px] border-l-amber-500/60 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Yesterday — Room to Improve</p>
              <p className="text-sm text-slate-300 italic">"{yesterdayLog.could_improve}"</p>
            </div>
          )}

          {/* Recent log history */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Recent Days</h2>
              <Link href="/analytics" className="text-xs text-violet-400 hover:text-violet-300">
                Full Analytics →
              </Link>
            </div>
            {recentLogs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No logs yet. Start logging!</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.slice(0, 7).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-[#1A1A3A] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${tierBgColor(log.score_tier ?? 'D')}`}>
                        {log.score_tier}
                      </span>
                      {log.day_win !== null && (
                        <span className="text-sm">{log.day_win ? '🏆' : '📉'}</span>
                      )}
                      <span className="text-sm text-slate-400">
                        {formatDate(log.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2 text-xs text-slate-500">
                        {['body_score', 'wealth_score', 'skill_score', 'discipline_score', 'presence_score'].map((k, i) => {
                          const icons = ['🔥', '💰', '⚡', '🛡️', '❤️'];
                          const val = log[k as keyof DailyLog] as number ?? 0;
                          return (
                            <span key={k} title={k.replace('_score', '')} className="hidden sm:inline">
                              {icons[i]}{Math.round(val)}
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-base font-bold text-white">
                        {Math.round(log.daily_life_score ?? 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
