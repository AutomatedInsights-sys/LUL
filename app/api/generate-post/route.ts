import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { SCORE_TIER_LABELS } from '@/lib/types';
import type { ScoreTier } from '@/lib/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface GeneratePostRequest {
  date: string;
  // Scores
  daily_life_score: number;
  score_tier: ScoreTier;
  body_score: number;
  wealth_score: number;
  skill_score: number;
  discipline_score: number;
  presence_score: number;
  // Inputs (for context)
  steps: number;
  sleep_hours: number;
  workout_done: boolean;
  workout_minutes: number;
  wealth_minutes: number;
  asset_brick: boolean;
  side_revenue: number;
  skill_minutes: number;
  skill_reps: number;
  operator_hour: boolean;
  no_scroll_am: boolean;
  presence_minutes: number;
  family_meal: boolean;
  // Journal
  day_win: boolean | null;
  went_well: string | null;
  could_improve: string | null;
  tomorrow_focus: string | null;
  // User context
  streak: number;
  level: number;
  total_xp: number;
  skill_rep_definition: string | null;
}

export interface GeneratePostResponse {
  summary: string;
  x_post: string;
  threads_post: string;
}

function buildPrompt(data: GeneratePostRequest): string {
  const tierLabel = SCORE_TIER_LABELS[data.score_tier] ?? data.score_tier;
  const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const winLossLine = data.day_win === true
    ? '✅ Self-assessed as a WIN'
    : data.day_win === false
    ? '❌ Self-assessed as a LOSS'
    : '(no win/loss verdict given)';

  const journalSection = [
    data.went_well && `What went well: "${data.went_well}"`,
    data.could_improve && `Could have been better: "${data.could_improve}"`,
    data.tomorrow_focus && `Tomorrow's focus: "${data.tomorrow_focus}"`,
  ].filter(Boolean).join('\n');

  return `You are a motivational performance coach and ghostwriter for a driven individual tracking their personal development through a gamified life dashboard called LevelUp Life.

Here is the data from their day — ${dateFormatted}:

## OVERALL SCORE
- Daily Life Score: ${Math.round(data.daily_life_score)}/100
- Tier: ${data.score_tier} — "${tierLabel}"
- ${winLossLine}

## DOMAIN SCORES (each out of 100)
- 🔥 Body: ${Math.round(data.body_score)} — Steps: ${data.steps.toLocaleString()}, Sleep: ${data.sleep_hours}h, Workout: ${data.workout_done ? `Yes (${data.workout_minutes} min)` : 'No'}
- 💰 Wealth: ${Math.round(data.wealth_score)} — Build time: ${data.wealth_minutes} min, Asset brick: ${data.asset_brick ? 'Yes' : 'No'}, Side revenue: $${data.side_revenue}
- ⚡ Skill: ${Math.round(data.skill_score)} — ${data.skill_minutes} min practice, ${data.skill_reps} reps${data.skill_rep_definition ? ` (${data.skill_rep_definition})` : ''}
- 🛡️ Discipline: ${Math.round(data.discipline_score)} — Operator hour: ${data.operator_hour ? 'Done' : 'Skipped'}, No-scroll AM: ${data.no_scroll_am ? 'Yes' : 'No'}
- ❤️ Presence: ${Math.round(data.presence_score)} — ${data.presence_minutes} min present, Family meal: ${data.family_meal ? 'Yes' : 'No'}

## GAMIFICATION
- Current streak: ${data.streak} days
- Level: ${data.level}
- Total XP: ${data.total_xp.toLocaleString()}

## JOURNAL REFLECTION
${journalSection || '(no journal entries for this day)'}

---

Generate three pieces of content based on this data. Be specific — use actual numbers and concrete details from the data above. The tone should be driven, honest, and grounded — NOT cringe-corporate or overly hyped. Write like a high-performer reflecting on their day, not a motivational poster.

Return your response as a JSON object with exactly these three keys:

{
  "summary": "A 2-3 sentence personal summary of the day. Lead with the score and tier, then highlight the standout wins and the biggest gap. Mention the streak if it's notable (7+ days). This is for the user's own record — honest and direct.",
  "x_post": "A post for X (Twitter). Max 260 characters. Include the score, tier emoji, one or two specific data points, and 2-3 relevant hashtags. Punchy and real — no fluff.",
  "threads_post": "A post for Threads. Max 480 characters. More narrative than X — tell the story of the day in 3-4 short sentences. Include the score, a highlight, an honest gap or lesson, and tomorrow's intention if provided. End with 2-3 hashtags."
}

Return only the JSON object. No markdown fences, no extra text.`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    );
  }

  let data: GeneratePostRequest;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildPrompt(data),
        },
      ],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Strip markdown fences if the model wraps anyway
    const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let result: GeneratePostResponse;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Model returned unparseable output', raw: rawText },
        { status: 500 }
      );
    }

    // Enforce character limits as a safety net
    if (result.x_post?.length > 280) {
      result.x_post = result.x_post.slice(0, 277) + '...';
    }
    if (result.threads_post?.length > 500) {
      result.threads_post = result.threads_post.slice(0, 497) + '...';
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
