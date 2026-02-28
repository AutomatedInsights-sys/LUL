'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { Card } from '@/components/ui/Card';
import { User, DomainWeights, PenaltyRule } from '@/lib/types';
import { DEFAULT_WEIGHTS } from '@/lib/scoring';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [skillRep, setSkillRep] = useState('');
  const [operatorHour, setOperatorHour] = useState('');
  const [skillRepTarget, setSkillRepTarget] = useState(3);
  const [scoreTarget, setScoreTarget] = useState(75);
  const [weights, setWeights] = useState<DomainWeights>(DEFAULT_WEIGHTS);
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);

  const domainsOrder: (keyof DomainWeights)[] = ['body', 'wealth', 'skill', 'discipline', 'presence'];
  const domainIcons: Record<keyof DomainWeights, string> = { body: '🔥', wealth: '💰', skill: '⚡', discipline: '🛡️', presence: '❤️' };

  const totalWeight = domainsOrder.reduce((sum, d) => sum + weights[d], 0);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile as User);
        setSkillRep(profile.skill_rep_definition ?? '');
        setOperatorHour(profile.operator_hour_definition ?? '');
        setSkillRepTarget(profile.skill_rep_target ?? 3);
        setScoreTarget(profile.score_target ?? 75);
        setWeights(profile.domain_weights ?? DEFAULT_WEIGHTS);
        setPenaltyRules(profile.penalty_rules ?? [
          { id: 'doom_scroll', rule_label: 'Doom Scrolled AM', penalty_text: '10 pushups', recovery_pts: 30, enabled: true, builtin: true },
          { id: 'missed_operator_hour', rule_label: 'Missed Operator Hour', penalty_text: '+20 min skill work', recovery_pts: 30, enabled: true, builtin: true },
        ]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    await supabase.from('users').update({
      skill_rep_definition: skillRep,
      operator_hour_definition: operatorHour,
      skill_rep_target: skillRepTarget,
      score_target: scoreTarget,
      domain_weights: weights,
      penalty_rules: penaltyRules,
    }).eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExport() {
    if (!user) return;
    setExportLoading(true);

    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (!logs || logs.length === 0) {
      alert('No data to export yet.');
      setExportLoading(false);
      return;
    }

    const headers = [
      'date', 'steps', 'workout_done', 'workout_minutes', 'sleep_hours',
      'wealth_minutes', 'asset_brick', 'side_revenue',
      'skill_minutes', 'skill_reps',
      'operator_hour', 'no_scroll_am',
      'presence_minutes', 'family_meal',
      'body_score', 'wealth_score', 'skill_score', 'discipline_score', 'presence_score',
      'daily_life_score', 'score_tier', 'xp_awarded',
    ];

    const rows = logs.map((l) =>
      headers.map((h) => {
        const v = l[h as keyof typeof l];
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v ?? '';
      }).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `levelup-life-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  }

  function updateWeight(domain: keyof DomainWeights, value: number) {
    setWeights((prev) => ({ ...prev, [domain]: value }));
  }

  function updatePenaltyRule(id: string, field: keyof PenaltyRule, value: string | number | boolean) {
    setPenaltyRules((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function addCustomRule() {
    setPenaltyRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), rule_label: '', penalty_text: '', recovery_pts: 10, enabled: true, builtin: false },
    ]);
  }

  function removeCustomRule(id: string) {
    setPenaltyRules((prev) => prev.filter((r) => r.id !== id));
  }

  const builtinRules = penaltyRules.filter((r) => r.builtin);
  const customRules = penaltyRules.filter((r) => !r.builtin);

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
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-slate-400 text-sm mt-0.5">Customize your LevelUp Life experience</p>
          </div>

          <div className="space-y-4">
            {/* Skill configuration */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">⚡ Skill Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Skill Rep Definition
                  </label>
                  <input
                    type="text"
                    value={skillRep}
                    onChange={(e) => setSkillRep(e.target.value)}
                    placeholder="1 rep = 1 sales outreach message"
                    className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-1">This shows in your daily log as a reminder</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Daily Rep Target: <span className="text-violet-400 font-bold">{skillRepTarget}</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setSkillRepTarget(Math.max(1, skillRepTarget - 1))}
                      className="w-10 h-10 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-xl font-bold flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={skillRepTarget}
                      onChange={(e) => setSkillRepTarget(Number(e.target.value))}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setSkillRepTarget(Math.min(20, skillRepTarget + 1))}
                      className="w-10 h-10 rounded-lg bg-[#1E1E3F] hover:bg-[#2D2D5E] text-xl font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Operator hour */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">🛡️ Operator Hour</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Your Morning/Focus Block</label>
                <input
                  type="text"
                  value={operatorHour}
                  onChange={(e) => setOperatorHour(e.target.value)}
                  placeholder="6–7am: journaling + planning + review"
                  className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </Card>

            {/* Score target */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">🎯 Score Target</h2>
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Daily Target: <span className="text-violet-400 font-bold">{scoreTarget}</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={scoreTarget}
                  onChange={(e) => setScoreTarget(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>50</span><span>75 (default)</span><span>100</span>
                </div>
              </div>
            </Card>

            {/* Domain weights */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Domain Weights</h2>
                <span className={`text-xs px-2 py-1 rounded border ${
                  totalWeight === 100
                    ? 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                    : 'text-red-400 border-red-500/30 bg-red-500/10'
                }`}>
                  Total: {totalWeight}%
                </span>
              </div>
              {totalWeight !== 100 && (
                <p className="text-xs text-red-400 mb-3">Weights must sum to 100%</p>
              )}
              <div className="space-y-3">
                {domainsOrder.map((domain) => (
                  <div key={domain} className="flex items-center gap-3">
                    <span className="text-lg">{domainIcons[domain]}</span>
                    <span className="text-sm text-slate-300 capitalize w-20">{domain}</span>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={5}
                      value={weights[domain]}
                      onChange={(e) => updateWeight(domain, Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-bold text-violet-400 w-10 text-right">{weights[domain]}%</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reset to defaults
              </button>
            </Card>

            {/* Penalty Rules */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">⚠️ Penalty Rules</h2>

              <div className="mb-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Built-in (auto-detected from daily log)</p>
                <div className="space-y-3">
                  {builtinRules.map((rule) => (
                    <div key={rule.id} className="bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-300">{rule.rule_label}</span>
                        <button
                          type="button"
                          onClick={() => updatePenaltyRule(rule.id, 'enabled', !rule.enabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled ? 'bg-violet-600' : 'bg-slate-700'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 mb-1 block">Penalty task</label>
                          <input
                            type="text"
                            value={rule.penalty_text}
                            onChange={(e) => updatePenaltyRule(rule.id, 'penalty_text', e.target.value)}
                            className="w-full bg-[#12122A] border border-[#2D2D5E] rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-xs text-slate-500 mb-1 block">Recovery pts</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={rule.recovery_pts}
                            onChange={(e) => updatePenaltyRule(rule.id, 'recovery_pts', Math.min(50, Number(e.target.value)))}
                            className="w-full bg-[#12122A] border border-[#2D2D5E] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Your Custom Rules (self-reported)</p>
                <div className="space-y-3">
                  {customRules.map((rule) => (
                    <div key={rule.id} className="bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg p-3">
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 mb-1 block">Rule name</label>
                          <input
                            type="text"
                            value={rule.rule_label}
                            onChange={(e) => updatePenaltyRule(rule.id, 'rule_label', e.target.value)}
                            placeholder="No phone at dinner"
                            className="w-full bg-[#12122A] border border-[#2D2D5E] rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomRule(rule.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors text-lg self-end mb-0.5"
                        >
                          🗑
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 mb-1 block">Penalty task</label>
                          <input
                            type="text"
                            value={rule.penalty_text}
                            onChange={(e) => updatePenaltyRule(rule.id, 'penalty_text', e.target.value)}
                            placeholder="10 pushups"
                            className="w-full bg-[#12122A] border border-[#2D2D5E] rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-xs text-slate-500 mb-1 block">Recovery pts</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={rule.recovery_pts}
                            onChange={(e) => updatePenaltyRule(rule.id, 'recovery_pts', Math.min(50, Number(e.target.value)))}
                            className="w-full bg-[#12122A] border border-[#2D2D5E] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCustomRule}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors border border-violet-600/30 hover:border-violet-500/50 rounded-lg px-3 py-2 w-full"
                >
                  + Add Custom Rule
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-4">
                Recovery pts are added to your Discipline score when you complete the penalty using a token. Max 50 pts per rule.
              </p>
            </Card>

            {/* Account info */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Account</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Email</span>
                  <span className="text-slate-200">{user?.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Member since</span>
                  <span className="text-slate-200">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Level</span>
                  <span className="text-violet-400 font-bold">{user?.level ?? 1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total XP</span>
                  <span className="text-teal-400 font-bold">{(user?.total_xp ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </Card>

            {/* Data export */}
            <Card>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Data Export</h2>
              <p className="text-sm text-slate-400 mb-4">
                Export all your daily logs as a CSV file for your own analysis.
              </p>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="bg-[#1E1E3F] hover:bg-[#2D2D5E] border border-[#2D2D5E] text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-50"
              >
                {exportLoading ? 'Exporting...' : '↓ Export CSV'}
              </button>
            </Card>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || totalWeight !== 100}
              className={`w-full py-4 rounded-xl font-bold text-base transition-all text-white ${
                saved
                  ? 'bg-teal-600'
                  : 'bg-violet-600 hover:bg-violet-500'
              } disabled:opacity-50`}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
