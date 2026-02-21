import React from 'react';
import type { LeaderboardEntry } from "@entities/analytics";
import { Medal, ScoreBadge } from "@shared/ui";

interface PodiumProps {
  topManagers: LeaderboardEntry[];
}

export const Podium: React.FC<PodiumProps> = ({ topManagers }) => {
  if (topManagers.length === 0) return null;

  // Reorder for horizontal podium: [2, 1, 3]
  const podiumOrder = [];
  if (topManagers[1]) podiumOrder.push({ data: topManagers[1], rank: 2 });
  if (topManagers[0]) podiumOrder.push({ data: topManagers[0], rank: 1 });
  if (topManagers[2]) podiumOrder.push({ data: topManagers[2], rank: 3 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end py-10 px-4">
      {podiumOrder.map((item) => (
        <div
          key={item.data.manager_id}
          className={`flex flex-col items-center ${
            item.rank === 1 ? 'order-1 md:order-2 z-10 scale-110 mb-8 md:mb-12' :
            item.rank === 2 ? 'order-2 md:order-1' : 'order-3'
          }`}
        >
          <div className="relative group">
            <div className={`relative flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-xl border-4 ${
              item.rank === 1 ? 'w-28 h-28 border-yellow-400' : 'w-24 h-24 border-slate-200 dark:border-slate-700'
            }`}>
              <span className={`text-3xl font-black ${item.rank === 1 ? 'text-yellow-600' : 'text-slate-400'}`}>
                {item.data.manager_name?.[0]}
              </span>
              <Medal rank={item.rank} className="absolute -bottom-2 -right-2 ring-4 ring-white dark:ring-slate-900" />
            </div>

            {item.rank === 1 && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">
                <span className="material-icons text-4xl">emoji_events</span>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
              {item.data.manager_name}
            </h3>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
              {item.data.total_calls} calls
            </p>
          </div>

          <ScoreBadge
            score={item.data.avg_kpi}
            label="KPI Score"
            size={item.rank === 1 ? 'lg' : 'md'}
            className="mt-4 shadow-lg shadow-primary/5"
          />
        </div>
      ))}
    </div>
  );
};
