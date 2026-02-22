'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import { DailyLog } from '@/lib/types';
import { tierBgColor } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

type Period = 'week' | 'month' | 'year';

const DOMAIN_COLORS = {
  body: '#FF6B6B',
  wealth: '#FFD93D',
  skill: '#6BCB77',
  discipline: '#4D96FF',
  presence: '#FF6FC8',
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A3A] border border-[#2D2D5E] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>■</span>
          <span className="text-slate-300 capitalize">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('week');
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      await fetchLogs(user.id, period);
      setLoading(false);
    }
    load();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchLogs(uid: string, p: Period) {
    setLoading(true);
    let from: Date;
    if (p === 'week') from = subDays(new Date(), 7);
    else if (p === 'month') from = subDays(new Date(), 30);
    else from = subMonths(new Date(), 12);

    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .gte('date', format(from, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    setLogs((data as DailyLog[]) ?? []);
    setLoading(false);
  }

  async function changePeriod(p: Period) {
    setPeriod(p);
    if (userId) await fetchLogs(userId, p);
  }

  // ---- Week view data ----
  const weekData = (() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) days.push(subDays(new Date(), i));
    return days.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const log = logs.find((l) => l.date === dateStr);
      return {
        day: format(d, 'EEE'),
        score: log?.daily_life_score ?? null,
        body: log?.body_score ?? null,
        wealth: log?.wealth_score ?? null,
        skill: log?.skill_score ?? null,
        discipline: log?.discipline_score ?? null,
        presence: log?.presence_score ?? null,
        tier: log?.score_tier ?? null,
      };
    });
  })();

  const weekBest = [...weekData].filter((d) => d.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const weekWorst = [...weekData].filter((d) => d.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const weekAvg = weekData.filter((d) => d.score !== null).length
    ? Math.round(weekData.filter((d) => d.score !== null).reduce((a, d) => a + (d.score ?? 0), 0) / weekData.filter((d) => d.score !== null).length)
    : 0;

  // ---- Month view data ----
  const monthDays = (() => {
    const days: Date[] = [];
    for (let i = 29; i >= 0; i--) days.push(subDays(new Date(), i));
    return days.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const log = logs.find((l) => l.date === dateStr);
      return {
        date: format(d, 'MMM d'),
        score: log?.daily_life_score ?? null,
        tier: log?.score_tier ?? null,
      };
    });
  })();

  // Calendar heatmap data for current month
  const calendarDays = (() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return eachDayOfInterval({ start, end }).map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const log = logs.find((l) => l.date === dateStr);
      return { date: d, dateStr, score: log?.daily_life_score ?? null, tier: log?.score_tier ?? null };
    });
  })();

  // ---- Year view data ----
  const yearData = (() => {
    const months: Array<{ month: string; avg: number; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const monthLogs = logs.filter((l) => l.date.startsWith(format(d, 'yyyy-MM')));
      const avg = monthLogs.length
        ? Math.round(monthLogs.reduce((a, l) => a + (l.daily_life_score ?? 0), 0) / monthLogs.length)
        : 0;
      months.push({ month: format(d, 'MMM'), avg, count: monthLogs.length });
    }
    return months;
  })();

  function heatmapColor(score: number | null): string {
    if (score === null) return '#1E1E3F';
    if (score >= 90) return '#FFD700';
    if (score >= 75) return '#FF6B35';
    if (score >= 60) return '#6C63FF';
    if (score >= 45) return '#00C9A7';
    return '#3A3A5E';
  }

  const domainAverages = (['body', 'wealth', 'skill', 'discipline', 'presence'] as const).map((d) => {
    const key = `${d}_score` as keyof DailyLog;
    const vals = logs.filter((l) => l[key] !== null).map((l) => l[key] as number);
    return {
      domain: d,
      avg: vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0,
    };
  });

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />
      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-slate-400 text-sm mt-0.5">Track your progress over time</p>
            </div>
            <div className="flex gap-1 bg-[#12122A] border border-[#1E1E3F] rounded-lg p-1">
              {(['week', 'month', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => changePeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                    period === p
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
          ) : (
            <>
              {/* ===== WEEK VIEW ===== */}
              {period === 'week' && (
                <div className="space-y-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <p className="text-xs text-slate-500 mb-1">Week Average</p>
                      <p className="text-2xl font-bold text-white">{weekAvg}</p>
                    </Card>
                    <Card>
                      <p className="text-xs text-slate-500 mb-1">Best Day</p>
                      <p className="text-2xl font-bold text-teal-400">{weekBest ? Math.round(weekBest.score ?? 0) : '—'}</p>
                      <p className="text-xs text-slate-500">{weekBest?.day ?? ''}</p>
                    </Card>
                    <Card>
                      <p className="text-xs text-slate-500 mb-1">Worst Day</p>
                      <p className="text-2xl font-bold text-slate-400">{weekWorst ? Math.round(weekWorst.score ?? 0) : '—'}</p>
                      <p className="text-xs text-slate-500">{weekWorst?.day ?? ''}</p>
                    </Card>
                  </div>

                  {/* 7-day bar chart */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">7-Day Score</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={weekData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E3F" />
                        <XAxis dataKey="day" stroke="#6870A0" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} stroke="#6870A0" tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="score" name="score" fill="#6C63FF" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Domain heatmap (7 days) */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Domain Breakdown</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left text-slate-500 text-xs py-2 pr-4">Domain</th>
                            {weekData.map((d) => (
                              <th key={d.day} className="text-center text-slate-500 text-xs py-2 px-2">{d.day}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(['body', 'wealth', 'skill', 'discipline', 'presence'] as const).map((domain) => (
                            <tr key={domain}>
                              <td className="text-slate-300 text-xs py-2 pr-4 capitalize">{domain}</td>
                              {weekData.map((d, i) => {
                                const val = d[domain];
                                return (
                                  <td key={i} className="text-center py-1.5 px-2">
                                    {val !== null ? (
                                      <span
                                        className="inline-block w-8 h-8 rounded-md text-xs font-bold leading-8 text-center"
                                        style={{
                                          background: heatmapColor(val),
                                          color: val && val > 40 ? '#0D0D1A' : '#6870A0',
                                        }}
                                      >
                                        {Math.round(val)}
                                      </span>
                                    ) : (
                                      <span className="inline-block w-8 h-8 rounded-md bg-[#1E1E3F]" />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Domain line chart */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Domain Trends (7 Days)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={weekData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E3F" />
                        <XAxis dataKey="day" stroke="#6870A0" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} stroke="#6870A0" tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#6870A0' }} />
                        {(Object.entries(DOMAIN_COLORS) as [keyof typeof DOMAIN_COLORS, string][]).map(([d, color]) => (
                          <Line
                            key={d}
                            type="monotone"
                            dataKey={d}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 3, fill: color }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

              {/* ===== MONTH VIEW ===== */}
              {period === 'month' && (
                <div className="space-y-4">
                  {/* 30-day line chart */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">30-Day Daily Score</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthDays} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E3F" />
                        <XAxis
                          dataKey="date"
                          stroke="#6870A0"
                          tick={{ fontSize: 10 }}
                          interval={4}
                        />
                        <YAxis domain={[0, 100]} stroke="#6870A0" tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="score"
                          name="score"
                          stroke="#6C63FF"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Calendar heatmap */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">
                      {format(new Date(), 'MMMM yyyy')} — Score Calendar
                    </p>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-xs text-slate-600 py-1">{d}</div>
                      ))}
                      {/* Offset for first day */}
                      {Array.from({ length: (new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {calendarDays.map(({ date, score, tier }) => (
                        <div
                          key={date.toISOString()}
                          className="aspect-square rounded-md flex items-center justify-center text-xs font-bold relative group"
                          style={{ background: heatmapColor(score) }}
                          title={score !== null ? `${format(date, 'MMM d')}: ${Math.round(score)} (${tier})` : format(date, 'MMM d')}
                        >
                          {format(date, 'd')}
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      <span className="text-xs text-slate-500">Score:</span>
                      {[
                        { label: '90+', color: '#FFD700' },
                        { label: '75+', color: '#FF6B35' },
                        { label: '60+', color: '#6C63FF' },
                        { label: '45+', color: '#00C9A7' },
                        { label: '<45', color: '#3A3A5E' },
                        { label: 'No log', color: '#1E1E3F' },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                          <span className="text-xs text-slate-500">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Domain averages */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">30-Day Domain Averages</p>
                    <div className="space-y-3">
                      {domainAverages.map(({ domain, avg }) => (
                        <div key={domain} className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 capitalize w-20">{domain}</span>
                          <div className="flex-1 h-2 bg-[#1E1E3F] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${avg}%`,
                                background: DOMAIN_COLORS[domain as keyof typeof DOMAIN_COLORS],
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-200 w-8 text-right">{avg}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* ===== YEAR VIEW ===== */}
              {period === 'year' && (
                <div className="space-y-4">
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">12-Month Average Score</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={yearData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E3F" />
                        <XAxis dataKey="month" stroke="#6870A0" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} stroke="#6870A0" tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="avg" name="avg" fill="#6C63FF" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {yearData.map(({ month, avg, count }) => (
                      <Card key={month} className="text-center">
                        <p className="text-xs text-slate-500 mb-1">{month}</p>
                        <p className="text-2xl font-bold text-white">{avg || '—'}</p>
                        <p className="text-xs text-slate-500 mt-1">{count} days logged</p>
                      </Card>
                    ))}
                  </div>

                  {/* Personal bests */}
                  <Card>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Personal Bests</p>
                    <div className="grid grid-cols-2 gap-4">
                      {(() => {
                        const allScored = logs.filter((l) => l.daily_life_score !== null);
                        const best = allScored.sort((a, b) => (b.daily_life_score ?? 0) - (a.daily_life_score ?? 0))[0];
                        const domainBests = (['body', 'wealth', 'skill', 'discipline', 'presence'] as const).map((d) => {
                          const key = `${d}_score` as keyof DailyLog;
                          const best = [...logs].sort((a, b) => ((b[key] as number) ?? 0) - ((a[key] as number) ?? 0))[0];
                          return { domain: d, score: best ? Math.round(best[key] as number) : 0 };
                        });

                        return (
                          <>
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Best Day Overall</p>
                              {best ? (
                                <>
                                  <p className="text-3xl font-bold text-yellow-400">{Math.round(best.daily_life_score ?? 0)}</p>
                                  <p className="text-xs text-slate-500">{best.date}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded border ${tierBgColor(best.score_tier ?? 'D')}`}>
                                    {best.score_tier}
                                  </span>
                                </>
                              ) : <p className="text-slate-500 text-sm">No data yet</p>}
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-slate-500 mb-2">Domain Peaks</p>
                              {domainBests.map(({ domain, score }) => (
                                <div key={domain} className="flex justify-between text-sm">
                                  <span className="text-slate-400 capitalize">{domain}</span>
                                  <span className="font-bold" style={{ color: DOMAIN_COLORS[domain as keyof typeof DOMAIN_COLORS] }}>{score}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
