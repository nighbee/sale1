import React from "react";

interface ScoreBarProps {
  value: number;
  barClassName: string;
  textClassName: string;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  value,
  barClassName,
  textClassName,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barClassName}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${textClassName}`}>
        {value.toFixed(0)}
      </span>
    </div>
  );
};
