'use client';

import { DOMAIN_COLORS, DOMAIN_ICONS } from '@/lib/types';
import { getScoreColor } from '@/lib/scoring';

interface DomainCardProps {
  domain: 'body' | 'wealth' | 'skill' | 'discipline' | 'presence';
  score: number;
  sparkline?: number[];
}

export default function DomainCard({ domain, score, sparkline = [] }: DomainCardProps) {
  const color = DOMAIN_COLORS[domain];
  const icon = DOMAIN_ICONS[domain];
  const label = domain.charAt(0).toUpperCase() + domain.slice(1);
  const scoreColor = getScoreColor(score);

  const maxSpark = Math.max(...sparkline, 1);
  const sparkWidth = 64;
  const sparkHeight = 28;

  return (
    <div
      className="bg-[#12122A] border border-[#1E1E3F] rounded-xl p-4 flex flex-col gap-2"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
        <span className="text-lg font-bold" style={{ color: scoreColor }}>
          {Math.round(score)}
        </span>
      </div>

      {/* Mini score bar */}
      <div className="h-1.5 bg-[#1E1E3F] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>

      {/* Sparkline */}
      {sparkline.length > 0 && (
        <svg width={sparkWidth} height={sparkHeight} className="ml-auto opacity-60">
          <polyline
            points={sparkline
              .map((v, i) => {
                const x = (i / (sparkline.length - 1)) * sparkWidth;
                const y = sparkHeight - (v / maxSpark) * sparkHeight;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
