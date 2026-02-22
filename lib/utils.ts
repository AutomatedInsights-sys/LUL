import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { DailyLog } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy');
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getWeekDates(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthDates(date: Date = new Date()): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
}

export function logsByDate(logs: DailyLog[]): Record<string, DailyLog> {
  return logs.reduce((acc, log) => {
    acc[log.date] = log;
    return acc;
  }, {} as Record<string, DailyLog>);
}

export function averageScore(logs: DailyLog[]): number {
  const scored = logs.filter((l) => l.daily_life_score !== null);
  if (scored.length === 0) return 0;
  const sum = scored.reduce((a, l) => a + (l.daily_life_score ?? 0), 0);
  return Math.round(sum / scored.length);
}

export function scoreGradient(score: number): string {
  if (score >= 90) return 'from-yellow-400 to-orange-400';
  if (score >= 75) return 'from-orange-400 to-red-400';
  if (score >= 60) return 'from-violet-500 to-purple-600';
  if (score >= 45) return 'from-teal-400 to-cyan-500';
  return 'from-slate-400 to-slate-500';
}

export function tierBgColor(tier: string): string {
  switch (tier) {
    case 'S': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'A': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'B': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'C': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    default:  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

export function xpForLevel(level: number): number {
  return (level - 1) * 1000;
}

export function levelFromXP(xp: number): number {
  return Math.min(100, Math.floor(xp / 1000) + 1);
}
