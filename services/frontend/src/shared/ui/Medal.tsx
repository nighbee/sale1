import React from 'react';
import { cn } from '../utils/cn';

interface MedalProps {
  rank: number;
  className?: string;
}

export const Medal: React.FC<MedalProps> = ({ rank, className }) => {
  const medals = [
    { icon: '🥇', bg: 'bg-amber-400', text: 'text-amber-900' },
    { icon: '🥈', bg: 'bg-slate-300', text: 'text-slate-800' },
    { icon: '🥉', bg: 'bg-orange-400', text: 'text-orange-900' },
  ];

  const medal = medals[rank - 1];

  if (!medal) {
    return (
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold",
        className
      )}>
        {rank}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex h-8 w-8 items-center justify-center rounded-full shadow-sm text-lg",
      medal.bg,
      className
    )}>
      {medal.icon}
    </div>
  );
};
