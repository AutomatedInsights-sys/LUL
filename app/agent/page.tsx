'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import { DailyLog, User, SCORE_TIER_LABELS } from '@/lib/types';
import { todayISO, tierBgColor, formatDate } from '@/lib/utils';
import type { GeneratePostRequest, GeneratePostResponse } from '@/app/api/generate-post/route';
import { format, subDays } from 'date-fns';

type CopyState = 'idle' | 'copied';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>('idle');

  async function copy() {
    await navigator.clipboard.writeText(text);
    setState('copied');
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
        state === 'copied'
          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
          : 'bg-[#1E1E3F] text-slate-400 hover:text-white border border-transparent hover:border-[#2D2D5E]'
      }`}
    >
      {state === 'copied' ? '✓ Copied' : `Copy ${label}`}
    </button>
  );
}

function CharCount({ text, max }: { text: string; max: number }) {
  const len = text.length;
  const over = len > max;
  return (
    <span className={`text-xs tabular-nums ${over ? 'text-red-400' : 'text-slate-500'}`}>
      {len}/{max}
    </span>
  );
}

function PostCard({
  platform,
  icon,
  color,
  borderColor,
  post,
  maxChars,
  editable,
  onChange,
}: {
  platform: string;
  icon: string;
  color: string;
  borderColor: string;
  post: string;
  maxChars: number;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="bg-[#12122A] border border-[#1E1E3F] rounded-xl overflow-hidden"
      style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A3A]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-white text-sm">{platform}</span>
        </div>
        <div className="flex items-center gap-2">
          <CharCount text={post} max={maxChars} />
          {post && <CopyButton text={post} label={platform} />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {editable ? (
          <textarea
            value={post}
            onChange={(e) => onChange(e.target.value)}
            rows={platform === 'Threads' ? 5 : 3}
            className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors resize-none leading-relaxed"
            style={{ color }}
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color }}>
            {post}
          </p>
        )}
      </div>
    </div>
  );
}

function AgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDate = searchParams.get('date');

  const [user, setUser] = useState<User | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Generated content
  const [summary, setSummary] = useState('');
  const [xPost, setXPost] = useState('');
  const [threadsPost, setThreadsPost] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [{ data: profile }, { data: logs }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', authUser.id)
          .gte('date', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
          .order('date', { ascending: false }),
      ]);

      if (profile) setUser(profile as User);

      const logsData = (logs as DailyLog[]) ?? [];
      setRecentLogs(logsData);

      // Pre-select: from URL param, or today, or most recent
      const target = preselectedDate ?? todayISO();
      const match = logsData.find((l) => l.date === target) ?? logsData[0] ?? null;
      setSelectedLog(match);

      setLoading(false);
    }
    load();
  }, [router, preselectedDate]);

  const generate = useCallback(async () => {
    if (!selectedLog || !user) return;
    setGenerating(true);
    setError('');
    setGenerated(false);
    setSummary('');
    setXPost('');
    setThreadsPost('');

    const payload: GeneratePostRequest = {
      date: selectedLog.date,
      daily_life_score: selectedLog.daily_life_score ?? 0,
      score_tier: selectedLog.score_tier ?? 'C',
      body_score: selectedLog.body_score ?? 0,
      wealth_score: selectedLog.wealth_score ?? 0,
      skill_score: selectedLog.skill_score ?? 0,
      discipline_score: selectedLog.discipline_score ?? 0,
      presence_score: selectedLog.presence_score ?? 0,
      steps: selectedLog.steps ?? 0,
      sleep_hours: selectedLog.sleep_hours ?? 0,
      workout_done: selectedLog.workout_done ?? false,
      workout_minutes: selectedLog.workout_minutes ?? 0,
      wealth_minutes: selectedLog.wealth_minutes ?? 0,
      asset_brick: selectedLog.asset_brick ?? false,
      side_revenue: selectedLog.side_revenue ?? 0,
      skill_minutes: selectedLog.skill_minutes ?? 0,
      skill_reps: selectedLog.skill_reps ?? 0,
      operator_hour: selectedLog.operator_hour ?? false,
      no_scroll_am: selectedLog.no_scroll_am ?? false,
      presence_minutes: selectedLog.presence_minutes ?? 0,
      family_meal: selectedLog.family_meal ?? false,
      day_win: selectedLog.day_win ?? null,
      went_well: selectedLog.went_well ?? null,
      could_improve: selectedLog.could_improve ?? null,
      tomorrow_focus: selectedLog.tomorrow_focus ?? null,
      streak: user.current_streak ?? 0,
      level: user.level ?? 1,
      total_xp: user.total_xp ?? 0,
      skill_rep_definition: user.skill_rep_definition ?? null,
    };

    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: GeneratePostResponse & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Generation failed. Try again.');
        setGenerating(false);
        return;
      }

      setSummary(data.summary ?? '');
      setXPost(data.x_post ?? '');
      setThreadsPost(data.threads_post ?? '');
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Try again.');
    }

    setGenerating(false);
  }, [selectedLog, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const tier = selectedLog?.score_tier ?? null;
  const score = selectedLog?.daily_life_score ?? null;

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />
      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🤖</span>
              <h1 className="text-2xl font-bold text-white">AI Agent</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Summarize your day and generate social posts for X and Threads — in your voice.
            </p>
          </div>

          {/* Day selector */}
          <Card className="mb-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Select Day</p>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No logged days found.{' '}
                <a href="/log" className="text-violet-400 hover:text-violet-300">Log today →</a>
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {recentLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <button
                      key={log.id}
                      onClick={() => {
                        setSelectedLog(log);
                        setGenerated(false);
                        setSummary('');
                        setXPost('');
                        setThreadsPost('');
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                        isSelected
                          ? 'bg-violet-600/20 border border-violet-500/40 text-white'
                          : 'bg-[#0D0D1A] border border-transparent hover:border-[#2D2D5E] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {log.day_win === true && <span>🏆</span>}
                        {log.day_win === false && <span>📉</span>}
                        <span>{formatDate(log.date)}</span>
                        {log.date === todayISO() && (
                          <span className="text-xs text-violet-400 font-medium">Today</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded border ${tierBgColor(log.score_tier ?? 'D')}`}
                        >
                          {log.score_tier}
                        </span>
                        <span className="font-bold text-white">{Math.round(log.daily_life_score ?? 0)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Selected day preview */}
          {selectedLog && (
            <Card className="mb-5 border-l-[3px] border-l-violet-500">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{formatDate(selectedLog.date)}</p>
                  {tier && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {SCORE_TIER_LABELS[tier]} · Score {Math.round(score ?? 0)}
                      {selectedLog.day_win !== null && (
                        <span className="ml-2">{selectedLog.day_win ? '🏆 Win' : '📉 Loss'}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span>🔥{Math.round(selectedLog.body_score ?? 0)}</span>
                  <span>💰{Math.round(selectedLog.wealth_score ?? 0)}</span>
                  <span>⚡{Math.round(selectedLog.skill_score ?? 0)}</span>
                  <span>🛡️{Math.round(selectedLog.discipline_score ?? 0)}</span>
                  <span>❤️{Math.round(selectedLog.presence_score ?? 0)}</span>
                </div>
              </div>
              {selectedLog.went_well && (
                <p className="text-xs text-slate-400 italic truncate">✓ "{selectedLog.went_well}"</p>
              )}
              {!selectedLog.went_well && !selectedLog.could_improve && !selectedLog.tomorrow_focus && (
                <p className="text-xs text-slate-600 italic">
                  No journal entries for this day — posts will be generated from score data only.
                </p>
              )}
            </Card>
          )}

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={!selectedLog || generating}
            className="w-full py-4 rounded-xl font-bold text-base bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all mb-6 flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : generated ? (
              '↺ Regenerate'
            ) : (
              '✨ Generate Posts'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Generated content */}
          {generated && (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Generated Content</p>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {editMode ? '✓ Done editing' : '✏️ Edit'}
                </button>
              </div>

              {/* Summary */}
              <Card className="border-l-[3px] border-l-slate-500">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">📋 Day Summary</p>
                  {summary && <CopyButton text={summary} label="Summary" />}
                </div>
                {editMode ? (
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors resize-none leading-relaxed"
                  />
                ) : (
                  <p className="text-sm text-slate-200 leading-relaxed">{summary}</p>
                )}
              </Card>

              {/* X post */}
              <PostCard
                platform="X (Twitter)"
                icon="𝕏"
                color="#e7e9ea"
                borderColor="#1d9bf0"
                post={xPost}
                maxChars={280}
                editable={editMode}
                onChange={setXPost}
              />

              {/* Threads post */}
              <PostCard
                platform="Threads"
                icon="@"
                color="#e4e6eb"
                borderColor="#0095f6"
                post={threadsPost}
                maxChars={500}
                editable={editMode}
                onChange={setThreadsPost}
              />

              {/* Copy all */}
              <button
                onClick={async () => {
                  const all = `DAY SUMMARY\n${summary}\n\n— X POST —\n${xPost}\n\n— THREADS —\n${threadsPost}`;
                  await navigator.clipboard.writeText(all);
                }}
                className="w-full py-3 rounded-xl border border-[#2D2D5E] text-slate-400 hover:text-white hover:border-violet-500/50 text-sm transition-all"
              >
                Copy All to Clipboard
              </button>
            </div>
          )}

          {/* Empty state */}
          {!generated && !generating && recentLogs.length > 0 && (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-slate-400 text-sm">
                Select a day above and hit Generate — Claude will write your summary and social posts based on your actual data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    }>
      <AgentContent />
    </Suspense>
  );
}
