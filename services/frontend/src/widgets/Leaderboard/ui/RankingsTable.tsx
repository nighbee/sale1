import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScoreBadge } from "../../../shared/ui/ScoreBadge";
import type { LeaderboardEntry } from "../../../entities/analytics/types";

interface RankingsTableProps {
  data: LeaderboardEntry[];
}

export const RankingsTable: React.FC<RankingsTableProps> = ({ data }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">
          {t("leaderboard.full_rankings")}
        </h3>
        <span className="text-xs text-slate-400">
          {data.length} {t("leaderboard.managers_count")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3">{t("leaderboard.columns.manager")}</th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.calls")}
              </th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.excellent")}
              </th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.avg_duration")}
              </th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.total_duration")}
              </th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.quality")}
              </th>
              <th className="px-5 py-3 text-center">
                {t("leaderboard.columns.errors_free")}
              </th>
              <th className="px-5 py-3 text-right">
                {t("leaderboard.columns.kpi_score")}
              </th>
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
                      <Link
                        to={`/calls?manager_id=${m.external_id}`}
                        className="font-medium text-slate-900 dark:text-white text-sm hover:text-primary transition-colors"
                      >
                        {m.manager_name}
                      </Link>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-0.5 text-xs font-semibold">
                    {m.total_calls}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {m.excellent_calls_count}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {m.total_calls > 0 ? ((m.excellent_calls_count / m.total_calls) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-500">
                  {m.avg_duration_minutes.toFixed(1)}m
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-500">
                  {m.total_duration_minutes >= 60
                    ? `${(m.total_duration_minutes / 60).toFixed(1)}h`
                    : `${m.total_duration_minutes.toFixed(0)}m`}
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex gap-2 justify-center">
                    <ScoreBadge score={m.avg_quality} label={t("leaderboard.columns.qual_short")} />
                    <ScoreBadge score={m.avg_script_match} label={t("leaderboard.columns.script_short")} />
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <ScoreBadge score={m.avg_errors_free} label={t("leaderboard.columns.errors_short")} />
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
