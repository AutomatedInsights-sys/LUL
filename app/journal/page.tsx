'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import { DailyLog } from '@/lib/types';
import { tierBgColor, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { format, subDays, subMonths } from 'date-fns';

type Filter = 'all' | 'wins' | 'losses' | 'unrated';

export default function JournalPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(subMonths(new Date(), 3), 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      setLogs((data as DailyLog[]) ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = logs.filter((l) => {
    // Only show entries that have at least one journal field
    const hasJournal = l.day_win !== null || l.went_well || l.could_improve || l.tomorrow_focus;
    if (!hasJournal && filter !== 'all') return false;

    if (filter === 'wins') return l.day_win === true;
    if (filter === 'losses') return l.day_win === false;
    if (filter === 'unrated') return l.day_win === null && hasJournal;
    return hasJournal;
  });

  // Aggregate stats
  const withVerdict = logs.filter((l) => l.day_win !== null);
  const wins = withVerdict.filter((l) => l.day_win === true).length;
  const losses = withVerdict.filter((l) => l.day_win === false).length;
  const winRate = withVerdict.length ? Math.round((wins / withVerdict.length) * 100) : null;

  // Collect recurring themes from "could_improve" (simple word frequency)
  const allImprovements = logs
    .filter((l) => l.could_improve)
    .map((l) => l.could_improve!)
    .join(' ')
    .toLowerCase();

  // Recent tomorrow_focus entries (last 7 that have one)
  const recentFocuses = logs
    .filter((l) => l.tomorrow_focus)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />
      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Journal</h1>
              <p className="text-slate-400 text-sm mt-0.5">Reflections, patterns, and tomorrow's focus</p>
            </div>
            <Link
              href="/log"
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Today's Entry
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="text-center">
              <p className="text-xs text-slate-500 mb-1">Win Rate</p>
              {winRate !== null ? (
                <>
                  <p className="text-2xl font-bold text-teal-400">{winRate}%</p>
                  <p className="text-xs text-slate-500 mt-1">{wins}W / {losses}L</p>
                </>
              ) : (
                <p className="text-slate-600 text-sm mt-1">No verdicts yet</p>
              )}
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-500 mb-1">Entries (90d)</p>
              <p className="text-2xl font-bold text-violet-400">{logs.filter((l) => l.went_well || l.could_improve || l.tomorrow_focus || l.day_win !== null).length}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-500 mb-1">Streak</p>
              <div>
                {(() => {
                  let streak = 0;
                  for (let i = 0; i < 90; i++) {
                    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
                    const log = logs.find((l) => l.date === d);
                    if (log && (log.went_well || log.could_improve || log.tomorrow_focus || log.day_win !== null)) {
                      streak++;
                    } else {
                      break;
                    }
                  }
                  return (
                    <>
                      <p className="text-2xl font-bold text-orange-400">{streak}</p>
                      <p className="text-xs text-slate-500 mt-1">days journaling</p>
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>

          {/* Recent focuses / tomorrow's mission panel */}
          {recentFocuses.length > 0 && (
            <Card className="mb-6 border-l-[3px] border-l-violet-500">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">🎯 Recent Focuses</p>
              <div className="space-y-2">
                {recentFocuses.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start">
                    <span className="text-xs text-slate-600 mt-0.5 w-16 flex-shrink-0">{format(new Date(log.date + 'T12:00:00'), 'MMM d')}</span>
                    <p className="text-sm text-slate-300 italic">"{log.tomorrow_focus}"</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 bg-[#12122A] border border-[#1E1E3F] rounded-lg p-1 mb-4 w-fit">
            {(['all', 'wins', 'losses', 'unrated'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'wins' ? '🏆 Wins' : f === 'losses' ? '📉 Losses' : f === 'unrated' ? 'Unrated' : 'All'}
              </button>
            ))}
          </div>

          {/* Journal entries */}
          {filtered.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-slate-500 text-sm mb-3">
                {filter === 'all'
                  ? 'No journal entries yet. Add reflections in your daily log.'
                  : `No ${filter} entries found.`}
              </p>
              <Link href="/log" className="text-violet-400 text-sm hover:text-violet-300">
                Go to today's log →
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => {
                const isExpanded = expanded === log.id;
                const hasContent = log.went_well || log.could_improve || log.tomorrow_focus;

                return (
                  <div
                    key={log.id}
                    className={`bg-[#12122A] border border-[#1E1E3F] rounded-xl overflow-hidden transition-all ${
                      log.day_win === true
                        ? 'border-l-[3px] border-l-teal-500'
                        : log.day_win === false
                        ? 'border-l-[3px] border-l-red-500'
                        : 'border-l-[3px] border-l-slate-600'
                    }`}
                  >
                    {/* Entry header — always visible */}
                    <button
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {log.day_win === true && <span className="text-lg flex-shrink-0">🏆</span>}
                        {log.day_win === false && <span className="text-lg flex-shrink-0">📉</span>}
                        {log.day_win === null && <span className="text-lg flex-shrink-0 opacity-30">○</span>}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">
                              {formatDate(log.date)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${tierBgColor(log.score_tier ?? 'D')}`}>
                              {log.score_tier} · {Math.round(log.daily_life_score ?? 0)}
                            </span>
                          </div>

                          {/* Preview of first field */}
                          {!isExpanded && log.tomorrow_focus && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              Focus: "{log.tomorrow_focus}"
                            </p>
                          )}
                          {!isExpanded && !log.tomorrow_focus && log.went_well && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              "{log.went_well}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-slate-500 text-xs flex-shrink-0">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && hasContent && (
                      <div className="px-4 pb-4 space-y-4 border-t border-[#1A1A3A] pt-3">
                        {log.went_well && (
                          <div>
                            <p className="text-xs text-teal-400 uppercase tracking-wider mb-1">What went well</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{log.went_well}</p>
                          </div>
                        )}
                        {log.could_improve && (
                          <div>
                            <p className="text-xs text-amber-400 uppercase tracking-wider mb-1">Could have done better</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{log.could_improve}</p>
                          </div>
                        )}
                        {log.tomorrow_focus && (
                          <div>
                            <p className="text-xs text-violet-400 uppercase tracking-wider mb-1">Focus set for next day</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{log.tomorrow_focus}</p>
                          </div>
                        )}

                        {/* Domain scores as a quick reference */}
                        <div className="flex gap-3 pt-1 border-t border-[#1A1A3A]">
                          {[
                            { icon: '🔥', val: log.body_score },
                            { icon: '💰', val: log.wealth_score },
                            { icon: '⚡', val: log.skill_score },
                            { icon: '🛡️', val: log.discipline_score },
                            { icon: '❤️', val: log.presence_score },
                          ].map(({ icon, val }) => (
                            <div key={icon} className="text-center">
                              <div className="text-sm">{icon}</div>
                              <div className="text-xs text-slate-500">{Math.round(val ?? 0)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recurring theme nudge if there are improvements logged */}
          {allImprovements.length > 50 && (
            <Card className="mt-6 border-l-[3px] border-l-amber-500">
              <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">💡 Pattern Recognition</p>
              <p className="text-sm text-slate-400">
                Review your "Could have done better" entries above. Recurring themes are your highest-leverage improvement areas.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
