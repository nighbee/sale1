import React from "react";

interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  label?: string;
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  maxScore = 100,
  label,
  className = "",
}) => {
  const percentage = (score / maxScore) * 100;

  const getColorClass = () => {
    if (percentage >= 80) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (percentage >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
  };

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <span className={`px-2 py-1 rounded-md text-xs font-bold ${getColorClass()}`}>
        {score.toFixed(1)}
        {maxScore === 100 && "%"}
      </span>
      {label && <span className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{label}</span>}
    </div>
  );
};
