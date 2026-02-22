# LevelUp Life — Web App

> Gamify Your Existence. Track What Matters.

A personal gamification dashboard that transforms daily behaviors into measurable scores, visual progress, and long-term growth metrics across **5 life domains**: Body, Wealth, Skill, Discipline, and Presence.

---

## Features

- **Daily Log** — Log all 13 metrics in under 60 seconds with in-app timers, toggles, and sliders
- **Live Score Preview** — See your Daily Life Score update in real time as you fill in the form
- **Gamified Scoring** — Domain scores (0–100) roll up into a Daily Life Score with tiers (S/A/B/C/D)
- **XP & Levels** — Earn XP for every logged day; streaks multiply your XP (up to 3×)
- **Dashboard** — Score ring, domain cards with 7-day sparklines, streak tracker, XP progress bar
- **Analytics** — Week, Month, and Year views with bar charts, line charts, and calendar heatmaps
- **Settings** — Configure Skill Rep, Operator Hour, domain weights, and score target
- **Data Export** — Download full history as CSV
- **Onboarding** — 5-screen guided setup flow

## Tech Stack

| Layer | Technology |
|---|---|
| Web App | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Charts | Recharts |
| Hosting | Vercel (recommended) |

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema from `supabase/schema.sql` in the Supabase SQL editor
3. Copy your project URL and anon key

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scoring System

| Domain | Weight | Key Inputs |
|---|---|---|
| Body | 25% | Steps (30pts), Sleep (40pts), Workout (30pts) |
| Wealth | 25% | Build Minutes (50pts), Asset Brick (30pts), Revenue (20pts) |
| Skill | 20% | Skill Minutes (60pts), Reps (40pts) |
| Discipline | 15% | Operator Hour (50pts), No-Scroll AM (50pts) |
| Presence | 15% | Presence Minutes (70pts), Family Meal (30pts) |

**Daily Life Score** = weighted average of all 5 domain scores (0–100)

| Tier | Score | XP |
|---|---|---|
| S — Locked In | 90–100 | 200 XP |
| A — On Fire | 75–89 | 150 XP |
| B — Solid Day | 60–74 | 100 XP |
| C — Showed Up | 45–59 | 60 XP |
| D — Rest & Reset | < 45 | 25 XP |

Streak multipliers: 7d = 1.25×, 14d = 1.5×, 30d = 2.0×, 90d = 3.0×

## Project Structure

```
app/
  login/          # Auth (login, signup, magic link)
  onboarding/     # 5-screen setup flow
  dashboard/      # Home screen
  log/            # Daily log form
  analytics/      # Week/Month/Year charts
  settings/       # User configuration
lib/
  types.ts        # TypeScript interfaces
  scoring.ts      # Scoring engine
  supabase.ts     # Client-side Supabase
  utils.ts        # Helper functions
components/
  NavBar.tsx      # Sidebar + mobile bottom nav
  ui/             # Reusable UI components
supabase/
  schema.sql      # Full DB schema with RLS policies
```

---

*LevelUp Life — Build the person you want to become.*
