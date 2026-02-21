import React from 'react';
import { cn } from '../utils/cn';

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  label,
  size = 'md',
  className,
}) => {
  const getColors = (s: number) => {
    if (s >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800';
    if (s >= 70) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800';
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-4 py-2 text-lg',
  };

  return (
    <div className={cn(
      "inline-flex flex-col items-center justify-center rounded-lg border font-bold transition-colors",
      getColors(score),
      sizes[size],
      className
    )}>
      <span className={cn(size === 'lg' ? 'text-2xl' : '')}>{score.toFixed(1)}</span>
      {label && <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">{label}</span>}
    </div>
  );
};
