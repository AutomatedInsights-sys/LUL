'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the confirmation link!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    }
    setLoading(false);
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setError(error.message);
    else setMessage('Magic link sent! Check your email.');
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D1A] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold gradient-text mb-2">LevelUp Life</h1>
          <p className="text-slate-400 text-sm">Gamify Your Existence. Track What Matters.</p>
        </div>

        {/* Domain icons */}
        <div className="flex justify-center gap-4 mb-8">
          {['🔥', '💰', '⚡', '🛡️', '❤️'].map((icon) => (
            <span
              key={icon}
              className="w-10 h-10 flex items-center justify-center bg-[#12122A] border border-[#1E1E3F] rounded-lg text-xl"
            >
              {icon}
            </span>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#12122A] border border-[#1E1E3F] rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-[#0D0D1A] border border-[#2D2D5E] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-4 py-3 text-sm text-teal-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#1E1E3F]" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-[#1E1E3F]" />
          </div>

          <button
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full bg-transparent border border-[#2D2D5E] hover:border-violet-500/50 text-slate-300 hover:text-white py-3 rounded-lg text-sm transition-all"
          >
            Send magic link
          </button>

          <p className="text-center text-sm text-slate-500 mt-6">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Body · Wealth · Skill · Discipline · Presence
        </p>
      </div>
    </div>
  );
}
