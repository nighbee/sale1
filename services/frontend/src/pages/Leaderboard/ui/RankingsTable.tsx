import React from "react";
import { ScoreBar } from "../../../shared/ui/ScoreBar";

interface LeaderboardEntry {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_errors_free: number;
  avg_overall_rating: number;
  avg_kpi: number;
  total_duration_minutes: number;
}

interface RankingsTableProps {
  data: LeaderboardEntry[];
}

const BAR_COLOR = {
  quality: "bg-indigo-500",
  script: "bg-emerald-500",
  errors: "bg-amber-400",
};
const TEXT_COLOR = {
  quality: "text-indigo-500",
  script: "text-emerald-500",
  errors: "text-amber-500",
};

export const RankingsTable: React.FC<RankingsTableProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">
          Full Rankings
        </h3>
        <span className="text-xs text-slate-400">{data.length} managers</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3">Manager</th>
              <th className="px-5 py-3 text-center">Calls</th>
              <th className="px-5 py-3 text-center">Duration</th>
              <th className="px-5 py-3 min-w-[140px]">Quality</th>
              <th className="px-5 py-3 min-w-[140px]">Script Match</th>
              <th className="px-5 py-3 min-w-[140px]">Errors Free</th>
              <th className="px-5 py-3 text-right">KPI Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((m, i) => (
              <tr
                key={m.manager_id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-5 py-4">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : i === 1
                          ? "bg-slate-200 text-slate-600"
                          : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {m.manager_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">
                        {m.manager_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        ID: {m.manager_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-0.5 text-xs font-semibold">
                    {m.total_calls}
                  </span>
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-500">
                  {m.total_duration_minutes >= 60
                    ? `${(m.total_duration_minutes / 60).toFixed(1)}h`
                    : `${m.total_duration_minutes.toFixed(0)}m`}
                </td>
                <td className="px-5 py-4">
                  <ScoreBar
                    value={m.avg_quality}
                    barClassName={BAR_COLOR.quality}
                    textClassName={TEXT_COLOR.quality}
                  />
                </td>
                <td className="px-5 py-4">
                  <ScoreBar
                    value={m.avg_script_match}
                    barClassName={BAR_COLOR.script}
                    textClassName={TEXT_COLOR.script}
                  />
                </td>
                <td className="px-5 py-4">
                  <ScoreBar
                    value={m.avg_errors_free}
                    barClassName={BAR_COLOR.errors}
                    textClassName={TEXT_COLOR.errors}
                  />
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="font-black text-primary text-base">
                    {m.avg_kpi.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
