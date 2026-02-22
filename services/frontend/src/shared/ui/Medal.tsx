import React from "react";

interface MedalProps {
  rank: number;
  className?: string;
}

export const Medal: React.FC<MedalProps> = ({ rank, className = "" }) => {
  const config = {
    1: { icon: "🥇", bg: "bg-yellow-400", text: "text-yellow-900", label: "Gold" },
    2: { icon: "🥈", bg: "bg-slate-300", text: "text-slate-800", label: "Silver" },
    3: { icon: "🥉", bg: "bg-orange-400", text: "text-orange-900", label: "Bronze" },
  }[rank as 1 | 2 | 3];

  if (!config) return null;

  return (
    <div
      className={`flex items-center justify-center w-8 h-8 rounded-full shadow-sm font-bold text-lg ${config.bg} ${config.text} ${className}`}
      title={config.label}
    >
      {config.icon}
    </div>
  );
};
