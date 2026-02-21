import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LeaderboardEntry } from "@entities/analytics";
import { Medal, Sparkline, ScoreBadge } from "@shared/ui";

interface AnalyticsTableProps {
  data: LeaderboardEntry[];
}

export const AnalyticsTable: React.FC<AnalyticsTableProps> = ({ data }) => {
  const { t } = useTranslation();

  // Helper to generate a fake trend for visual demonstration (since API returns current snapshot)
  const getFakeTrend = (base: number) => {
    return [base - 5, base - 2, base + 3, base - 1, base + 5, base];
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">
          {t('leaderboard.full_rankings')}
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600">
          {data.length} MANAGERS
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-50 dark:border-slate-800">
              <th className="px-6 py-4 w-16">Rank</th>
              <th className="px-6 py-4">Manager</th>
              <th className="px-6 py-4">Trend (KPI)</th>
              <th className="px-6 py-4 text-center">Stats</th>
              <th className="px-6 py-4">Performance Breakdown</th>
              <th className="px-6 py-4 text-right">Overall KPI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.map((m, i) => (
              <tr key={m.manager_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-all group">
                <td className="px-6 py-5">
                  <Medal rank={i + 1} />
                </td>

                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                      {m.manager_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                        {m.manager_name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-tighter">
                        ID: {m.manager_id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5">
                  <Sparkline
                    data={getFakeTrend(m.avg_kpi)}
                    color={m.avg_kpi > 80 ? '#10b981' : '#f59e0b'}
                    width={80}
                    height={24}
                  />
                </td>

                <td className="px-6 py-5">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{m.total_calls}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Calls</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                        {m.total_duration_minutes.toFixed(0)}m
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Time</p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5">
                  <div className="space-y-2 max-w-[180px]">
                    <div className="flex justify-between text-[9px] font-bold uppercase mb-1">
                      <span className="text-indigo-500">Quality</span>
                      <span>{m.avg_quality.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${m.avg_quality}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold uppercase mb-1 pt-1">
                      <span className="text-emerald-500">Script</span>
                      <span>{m.avg_script_match.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${m.avg_script_match}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5 text-right">
                  <ScoreBadge score={m.avg_kpi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
