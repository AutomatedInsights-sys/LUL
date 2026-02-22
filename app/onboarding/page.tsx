'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const steps = [
  { id: 'welcome', title: 'Welcome to LevelUp Life' },
  { id: 'skill_rep', title: 'Define Your Skill Rep' },
  { id: 'operator_hour', title: 'Define Your Operator Hour' },
  { id: 'rep_target', title: 'Set Daily Rep Target' },
  { id: 'complete', title: "You're Ready" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    skill_rep_definition: '',
    operator_hour_definition: '',
    skill_rep_target: 3,
  });

  const SKILL_EXAMPLES = [
    '1 rep = 1 sales outreach message',
    '1 rep = 1 page written',
    '1 rep = 1 coding session',
    '1 rep = 1 pitch deck slide',
  ];

  const OPERATOR_EXAMPLES = [
    '5–6am: cold plunge + journaling + planning',
    '6–7am: meditation + priority review',
    '5:30–6:30am: reading + workout',
    '7–8am: deep work block, no meetings',
  ];

  async function finish() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      skill_rep_definition: formData.skill_rep_definition || '1 rep = 1 focused session',
      operator_hour_definition: formData.operator_hour_definition || '6–7am: journaling + planning',
      skill_rep_target: formData.skill_rep_target,
      onboarding_complete: true,
    });

    router.push('/dashboard');
  }

  const current = steps[step];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D1A] px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-1 rounded-full transition-all ${
                i <= step ? 'bg-violet-600' : 'bg-[#1E1E3F]'
              }`}
            />
          ))}
        </div>

        <div className="bg-[#12122A] border border-[#1E1E3F] rounded-2xl p-8 min-h-[380px] flex flex-col">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
              <div className="text-6xl">🚀</div>
              <div>
                <h1 className="text-3xl font-bold gradient-text mb-3">LevelUp Life</h1>
                <p className="text-slate-400 leading-relaxed max-w-sm">
                  Your personal RPG for real life. Track 5 domains daily, earn XP, build streaks, and
                  watch your stats compound over time.
                </p>
              </div>
              <div className="grid grid-cols-5 gap-3 mt-2">
                {[
                  { icon: '🔥', label: 'Body' },
                  { icon: '💰', label: 'Wealth' },
                  { icon: '⚡', label: 'Skill' },
                  { icon: '🛡️', label: 'Discipline' },
                  { icon: '❤️', label: 'Presence' },
                ].map((d) => (
                  <div key={d.label} className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{d.icon}</span>
                    <span className="text-xs text-slate-500">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Skill Rep */}
          {step === 1 && (
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <div className="text-3xl mb-3">⚡</div>
                <h2 className="text-xl font-bold text-white mb-2">What counts as a Skill Rep?</h2>
                <p className="text-slate-400 text-sm">
                  A rep is one unit of deliberate practice. Define it so it shows up in your daily log as a reminder.
                </p>
              </div>
              <input
                type="text"
                value={formData.skill_rep_definition}
                onChange={(e) => setFormData({ ...formData, skill_rep_definition: e.target.value })}
                placeholder="1 rep = ..."
                className="bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Examples:</p>
                {SKILL_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setFormData({ ...formData, skill_rep_definition: ex })}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-[#0D0D1A] hover:bg-[#1E1E3F] transition-all border border-transparent hover:border-[#2D2D5E]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Operator Hour */}
          {step === 2 && (
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <div className="text-3xl mb-3">🛡️</div>
                <h2 className="text-xl font-bold text-white mb-2">Define Your Operator Hour</h2>
                <p className="text-slate-400 text-sm">
                  Your morning/focus block. This is your protected time for high-leverage work. The log will ask you if you completed it each day.
                </p>
              </div>
              <input
                type="text"
                value={formData.operator_hour_definition}
                onChange={(e) => setFormData({ ...formData, operator_hour_definition: e.target.value })}
                placeholder="5–6am: ..."
                className="bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Examples:</p>
                {OPERATOR_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setFormData({ ...formData, operator_hour_definition: ex })}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white bg-[#0D0D1A] hover:bg-[#1E1E3F] transition-all border border-transparent hover:border-[#2D2D5E]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Rep Target */}
          {step === 3 && (
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <div className="text-3xl mb-3">🎯</div>
                <h2 className="text-xl font-bold text-white mb-2">Daily Rep Target</h2>
                <p className="text-slate-400 text-sm">
                  How many reps do you aim to complete each day? This sets your scoring baseline.
                </p>
              </div>
              <div className="flex items-center justify-center gap-6 py-8">
                <button
                  onClick={() => setFormData({ ...formData, skill_rep_target: Math.max(1, formData.skill_rep_target - 1) })}
                  className="w-12 h-12 rounded-full bg-[#1E1E3F] hover:bg-[#2D2D5E] text-2xl font-bold flex items-center justify-center transition-colors"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-6xl font-bold text-violet-400">{formData.skill_rep_target}</span>
                  <p className="text-sm text-slate-500 mt-1">reps / day</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, skill_rep_target: Math.min(20, formData.skill_rep_target + 1) })}
                  className="w-12 h-12 rounded-full bg-[#1E1E3F] hover:bg-[#2D2D5E] text-2xl font-bold flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center">
                {formData.skill_rep_definition || '1 rep = 1 focused session'} = 1 rep
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
              <div className="text-6xl">🏆</div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">You're all set!</h2>
                <p className="text-slate-400 leading-relaxed">
                  Your profile is configured. Log your first day, earn XP, and start building your streak.
                  Every day you log gets you closer to who you want to become.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mt-2">
                {[
                  { label: 'Start', val: 'Level 1' },
                  { label: 'Target', val: '75+ daily' },
                  { label: 'Streak', val: 'Day 1' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#0D0D1A] rounded-lg p-3">
                    <div className="text-lg font-bold text-violet-400">{stat.val}</div>
                    <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-auto pt-6">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-lg border border-[#2D2D5E] text-slate-400 hover:text-white hover:border-violet-500/50 transition-all text-sm"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                {step === 0 ? 'Get Started' : 'Continue'}
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={loading}
                className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {loading ? 'Setting up...' : 'Start Logging →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
