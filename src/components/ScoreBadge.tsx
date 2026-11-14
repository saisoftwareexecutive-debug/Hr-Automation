import React from 'react';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreBadge({ score, size = 'md', showLabel = true }: ScoreBadgeProps) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  let colorClasses = 'bg-surface-hover text-secondary border-border';
  let tierLabel = 'Unscored';

  if (safeScore >= 85) {
    colorClasses = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-500/20';
    tierLabel = 'Top Match';
  } else if (safeScore >= 70) {
    colorClasses = 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 ring-1 ring-sky-500/20';
    tierLabel = 'Good Fit';
  } else if (safeScore >= 50) {
    colorClasses = 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 ring-1 ring-amber-500/20';
    tierLabel = 'Moderate';
  } else if (safeScore > 0) {
    colorClasses = 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 ring-1 ring-rose-500/20';
    tierLabel = 'Low Fit';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3.5 py-1.5 font-bold',
  }[size] || 'text-sm px-2.5 py-1';

  if (safeScore === 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-dashed font-medium text-secondary bg-surface-subtle border-border ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-muted"></span>
        Pending reply
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${colorClasses} ${sizeClasses} shadow-2xs`}>
      <span className="font-mono font-bold">{safeScore}/100</span>
      {showLabel && <span className="opacity-90 font-medium text-[11px]">({tierLabel})</span>}
    </span>
  );
}
