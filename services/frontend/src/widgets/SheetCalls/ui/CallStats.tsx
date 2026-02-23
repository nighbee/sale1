import React from 'react';
import type { Call } from '../../../entities/call/types';

interface CallStatsProps {
  calls: Call[];
  loading: boolean;
}

export const CallStats: React.FC<CallStatsProps> = ({ calls, loading }) => {
  const completedCalls = calls.filter(c => c.status === 'completed');
  const avgQuality = completedCalls.length
    ? (completedCalls.reduce((acc, c) => acc + (c.quality_score || 0), 0) / completedCalls.length).toFixed(1)
    : '0';

  const totalDurationSeconds = calls.reduce((acc, c) => acc + (c.duration || 0), 0);
  const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);

  const highQualityCount = completedCalls.filter(c => (c.quality_score || 0) >= 80).length;
  const successRate = completedCalls.length
    ? Math.round((highQualityCount / completedCalls.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-blue-500 text-sm">phone</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Calls</span>
        </div>
        <p className="text-2xl font-black text-slate-800 dark:text-white">{calls.length}</p>
      </div>

      <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-emerald-500 text-sm">verified</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Avg Quality</span>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-black text-slate-800 dark:text-white">{avgQuality}</p>
          <p className="text-xs font-bold text-slate-400">/ 100</p>
        </div>
      </div>

      <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-indigo-500 text-sm">timer</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Duration</span>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-black text-slate-800 dark:text-white">{totalDurationMinutes}</p>
          <p className="text-xs font-bold text-slate-400">min</p>
        </div>
      </div>

      <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-rose-500 text-sm">trending_up</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Success Rate</span>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-black text-slate-800 dark:text-white">{successRate}</p>
          <p className="text-xs font-bold text-slate-400">%</p>
        </div>
      </div>
    </div>
  );
};
