'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import type { Penalty, User } from '@/lib/types';
import { applyPenaltyRecovery } from '@/lib/penalties';
import { format } from 'date-fns';

type Tab = 'pending' | 'history';

export default function PenaltiesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null); // penalty id
  const [confirmRedeemId, setConfirmRedeemId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [{ data: profile }, { data: penaltyData }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('penalties').select('*').eq('user_id', authUser.id).order('log_date', { ascending: false }),
      ]);

      if (profile) setUser(profile as User);
      if (penaltyData) setPenalties(penaltyData as Penalty[]);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleBuyToken() {
    if (!user || (user.total_xp ?? 0) < 100) return;
    setActionLoading('buy');

    const newXP = user.total_xp - 100;
    const newTokens = Math.min(10, (user.penalty_tokens ?? 0) + 1);
    const newSpent = (user.penalty_tokens_spent ?? 0) + 1;
    const newLevel = Math.min(100, Math.floor(newXP / 1000) + 1);

    const { error } = await supabase.from('users').update({
      total_xp: newXP,
      level: newLevel,
      penalty_tokens: newTokens,
      penalty_tokens_spent: newSpent,
    }).eq('id', user.id);

    if (!error) {
      setUser((prev) => prev ? { ...prev, total_xp: newXP, level: newLevel, penalty_tokens: newTokens, penalty_tokens_spent: newSpent } : prev);
      showToast('🪙 Token purchased! 100 XP spent.');
    } else {
      showToast('Failed to purchase token.', 'error');
    }
    setActionLoading(null);
  }

  async function handleUseToken(penaltyId: string) {
    if (!user || (user.penalty_tokens ?? 0) < 1) {
      showToast('No tokens available.', 'error');
      return;
    }
    setActionLoading(penaltyId);
    setConfirmRedeemId(null);

    const newTokens = (user.penalty_tokens ?? 1) - 1;

    const [{ error: penError }, { error: userError }] = await Promise.all([
      supabase.from('penalties').update({ token_used: true }).eq('id', penaltyId),
      supabase.from('users').update({ penalty_tokens: newTokens }).eq('id', user.id),
    ]);

    if (!penError && !userError) {
      setPenalties((prev) => prev.map((p) => p.id === penaltyId ? { ...p, token_used: true } : p));
      setUser((prev) => prev ? { ...prev, penalty_tokens: newTokens } : prev);
      showToast('🪙 Token spent — complete the task to restore your points!');
    } else {
      showToast('Failed to use token.', 'error');
    }
    setActionLoading(null);
  }

  async function handleDismiss(penaltyId: string) {
    setActionLoading(penaltyId);
    const { error } = await supabase.from('penalties').update({ dismissed: true }).eq('id', penaltyId);
    if (!error) {
      setPenalties((prev) => prev.map((p) => p.id === penaltyId ? { ...p, dismissed: true } : p));
      showToast('Penalty declined — score stays as-is.');
    } else {
      showToast('Failed to decline penalty.', 'error');
    }
    setActionLoading(null);
  }

  async function handleMarkDone(penalty: Penalty) {
    setActionLoading(penalty.id);

    try {
      const result = await applyPenaltyRecovery(penalty, supabase);

      // Update local state
      setPenalties((prev) => prev.map((p) =>
        p.id === penalty.id
          ? { ...p, completed: true, completed_at: new Date().toISOString(), score_restored: penalty.recovery_pts }
          : p
      ));

      let msg = `✅ Done! +${Math.round(penalty.recovery_pts)} discipline pts restored.`;
      if (result.xpDelta > 0) msg += ` +${result.xpDelta} XP earned.`;
      if (result.newTier) msg += ` New tier: ${result.newTier}.`;
      showToast(msg);

      // Refresh user data
      const { data: freshUser } = await supabase.from('users').select('*').eq('id', penalty.user_id).single();
      if (freshUser) setUser(freshUser as User);
    } catch {
      showToast('Failed to apply recovery. Try again.', 'error');
    }

    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const pending = penalties.filter((p) => !p.completed && !p.dismissed);
  const history = penalties.filter((p) => p.completed || p.dismissed);
  const completed = penalties.filter((p) => p.completed);
  const totalEarned = (user?.penalty_tokens ?? 0) + (user?.penalty_tokens_spent ?? 0);
  const completionRate = penalties.length > 0
    ? Math.round((completed.length / penalties.length) * 100)
    : null;

  const tokenCount = user?.penalty_tokens ?? 0;
  const canBuyToken = (user?.total_xp ?? 0) >= 100 && tokenCount < 10;

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      <NavBar />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 text-sm font-semibold px-4 py-2 rounded-full shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-teal-500 text-black' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Confirm redeem dialog */}
      {confirmRedeemId && (() => {
        const pen = penalties.find((p) => p.id === confirmRedeemId);
        if (!pen) return null;
        return (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4">
            <div className="bg-[#12122A] border border-[#2D2D5E] rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-white font-bold text-lg mb-2">Spend 1 Token?</h3>
              <p className="text-slate-400 text-sm mb-4">
                You&apos;ll need to complete <span className="text-white font-medium">&quot;{pen.penalty_text}&quot;</span> to restore{' '}
                <span className="text-teal-400 font-medium">+{pen.recovery_pts} discipline pts</span>.
                You have <span className="text-amber-400 font-medium">{tokenCount} token{tokenCount !== 1 ? 's' : ''}</span>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleUseToken(confirmRedeemId)}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded-lg text-sm transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmRedeemId(null)}
                  className="flex-1 bg-[#1E1E3F] hover:bg-[#2D2D5E] text-slate-300 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="md:ml-56 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">⚠️ Penalties</h1>
              <p className="text-slate-400 text-sm mt-0.5">Violations, redemptions, and token shop</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-amber-400">🪙 {tokenCount}</div>
              <div className="text-xs text-slate-500">tokens</div>
            </div>
          </div>

          {/* Token Shop */}
          <Card className="mb-6 border-l-[3px] border-l-amber-500">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-400 mb-0.5">Token Shop</p>
                <p className="text-xs text-slate-500">
                  {tokenCount}/10 tokens · {totalEarned} earned total
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Earn more: 7d streak → +1 · 14d → +1 · 30d → +2 · 90d → +3
                </p>
              </div>
              <div className="text-right">
                <button
                  onClick={handleBuyToken}
                  disabled={!canBuyToken || actionLoading === 'buy'}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-sm px-4 py-2 rounded-lg transition-all"
                >
                  {actionLoading === 'buy' ? 'Buying...' : 'Buy 1 Token — 100 XP'}
                </button>
                <p className="text-xs text-slate-500 mt-1">
                  Your XP: {(user?.total_xp ?? 0).toLocaleString()}
                  {tokenCount >= 10 && ' · Token cap reached'}
                </p>
              </div>
            </div>
          </Card>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <Card className="text-center !py-2">
              <p className="text-xs text-slate-500">Pending</p>
              <p className={`text-xl font-bold ${pending.length > 0 ? 'text-red-400' : 'text-teal-400'}`}>{pending.length}</p>
            </Card>
            <Card className="text-center !py-2">
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-xl font-bold text-teal-400">{completed.length}</p>
            </Card>
            <Card className="text-center !py-2">
              <p className="text-xs text-slate-500">Done %</p>
              <p className="text-xl font-bold text-violet-400">{completionRate !== null ? `${completionRate}%` : '—'}</p>
            </Card>
            <Card className="text-center !py-2">
              <p className="text-xs text-slate-500">Tokens earned</p>
              <p className="text-xl font-bold text-amber-400">{totalEarned}</p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#12122A] border border-[#1E1E3F] rounded-lg p-1 mb-4 w-fit">
            {(['pending', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                  tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'pending' ? `⚠️ Pending (${pending.length})` : `✓ History (${history.length})`}
              </button>
            ))}
          </div>

          {/* Pending tab */}
          {tab === 'pending' && (
            <div className="space-y-3">
              {pending.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-teal-400 text-2xl mb-2">✓</p>
                  <p className="text-slate-400 text-sm">No pending penalties — you&apos;re clean!</p>
                </Card>
              ) : (
                pending.map((pen) => (
                  <div
                    key={pen.id}
                    className="bg-[#12122A] border border-[#1E1E3F] border-l-[3px] border-l-orange-500 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{pen.rule_label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {format(new Date(pen.log_date + 'T12:00:00'), 'EEE, MMM d')}
                        </p>
                      </div>
                      {pen.token_used && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          🪙 Redeemed
                        </span>
                      )}
                    </div>

                    <div className="bg-[#0D0D1A] rounded-lg px-3 py-2 mb-3">
                      <p className="text-xs text-slate-500">Complete:</p>
                      <p className="text-sm font-medium text-slate-200">{pen.penalty_text}</p>
                      <p className="text-xs text-teal-400 mt-0.5">+{pen.recovery_pts} pts restored on done</p>
                    </div>

                    <div className="flex gap-2">
                      {!pen.token_used ? (
                        <button
                          onClick={() => setConfirmRedeemId(pen.id)}
                          disabled={actionLoading === pen.id || tokenCount < 1}
                          className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-semibold text-sm py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          🪙 Use Token → Redeem
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkDone(pen)}
                          disabled={actionLoading === pen.id}
                          className="flex-1 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-400 font-bold text-sm py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          {actionLoading === pen.id ? 'Applying...' : '✓ Mark Done'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(pen.id)}
                        disabled={actionLoading === pen.id}
                        className="bg-[#1E1E3F] hover:bg-[#2D2D5E] border border-[#2D2D5E] text-slate-500 hover:text-slate-300 text-sm px-3 py-2 rounded-lg transition-all disabled:opacity-40"
                        title="Decline — keep current score, no token spent"
                      >
                        Decline
                      </button>
                    </div>
                    {!pen.token_used && tokenCount < 1 && (
                      <p className="text-xs text-slate-600 mt-2 text-center">No tokens — buy one above, earn via streak, or decline to clear</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* History tab */}
          {tab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-slate-500 text-sm">No history yet.</p>
                </Card>
              ) : (
                history.map((pen) => (
                  <div
                    key={pen.id}
                    className={`bg-[#12122A] border border-[#1E1E3F] border-l-[3px] rounded-xl p-4 ${
                      pen.dismissed ? 'border-l-slate-600' : 'border-l-teal-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={pen.dismissed ? 'text-slate-500' : 'text-teal-400'}>
                            {pen.dismissed ? '—' : '✓'}
                          </span>
                          <p className="text-sm font-semibold text-white">{pen.rule_label}</p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {format(new Date(pen.log_date + 'T12:00:00'), 'EEE, MMM d')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {pen.dismissed ? 'Declined — no token spent' : `Completed: ${pen.penalty_text}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {pen.dismissed ? (
                          <span className="text-xs bg-slate-700/50 text-slate-500 border border-slate-600/30 px-2 py-0.5 rounded-full">
                            Declined
                          </span>
                        ) : pen.score_restored != null ? (
                          <span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full">
                            +{Math.round(pen.score_restored)} pts
                          </span>
                        ) : null}
                        {pen.completed_at && (
                          <p className="text-xs text-slate-600 mt-1">
                            {format(new Date(pen.completed_at), 'h:mmaaa')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
