import React from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { LeaderboardEntry } from "../../../entities/analytics/types";

interface ComparisonChartProps {
  data: LeaderboardEntry[];
}

const CHART_COLORS = {
  quality: "#6366f1",
  script: "#10b981",
  errors: "#f59e0b",
};

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  const { t } = useTranslation();
  const chartData = React.useMemo(
    () =>
      data.slice(0, 10).map((m) => ({
        name:
          m.manager_name?.length > 10
            ? m.manager_name.slice(0, 10) + "…"
            : m.manager_name,
        Quality: +m.avg_quality.toFixed(1),
        Script: +m.avg_script_match.toFixed(1),
        Errors: +m.avg_errors_free.toFixed(1),
      })),
    [data],
  );

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
        {t('leaderboard.charts.avg_scores_top', { count: chartData.length })}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
          <Bar
            dataKey="Quality"
            fill={CHART_COLORS.quality}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="Script"
            fill={CHART_COLORS.script}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="Errors"
            fill={CHART_COLORS.errors}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
