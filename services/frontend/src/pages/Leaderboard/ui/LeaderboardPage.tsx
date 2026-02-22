import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../../widgets/PageLayout";
import { analyticsApi } from "../../../entities/analytics/api";
import { useUserStore } from "../../../entities/user/model/store";
import { Podium } from "./Podium";
import { RankingsTable } from "./RankingsTable";
import { ComparisonChart } from "./ComparisonChart";

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

type SortKey =
  | "avg_kpi"
  | "avg_quality"
  | "avg_script_match"
  | "avg_errors_free"
  | "total_calls";
type Period = "" | "7d" | "30d" | "90d";
type Source = "" | "google_sheets" | "sipuni";

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();

  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [source, setSource] = useState<Source>("");
  const [sortBy, setSortBy] = useState<SortKey>("avg_kpi");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { sort_by: sortBy };
      if (currentTeamId) params.team_id = currentTeamId;
      if (period) params.period = period;
      if (source) params.source = source;
      const res = await analyticsApi.getLeaderboard(params);
      const responseData = res.data as { leaderboard?: LeaderboardEntry[] };
      setData(responseData.leaderboard || []);
    } catch {
      console.error("Failed to fetch leaderboard");
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, period, source, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: string) => {
    try {
      const params: Record<string, unknown> = { sort_by: sortBy };
      if (currentTeamId) params.team_id = currentTeamId;
      if (period) params.period = period;
      if (source) params.source = source;
      const res = await analyticsApi.exportLeaderboard(format, params);
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `leaderboard.${format === "excel" ? "xlsx" : format}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "avg_kpi", label: "KPI Score" },
    { key: "avg_quality", label: "Quality" },
    { key: "avg_script_match", label: "Script Match" },
    { key: "avg_errors_free", label: "Errors Free" },
    { key: "total_calls", label: "Calls Count" },
  ];

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
    { key: "", label: "All time" },
  ];

  return (
    <PageLayout title={t("leaderboard.title")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t("leaderboard.title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t("leaderboard.subtitle")}
            </p>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:opacity-90 transition-all">
              <span className="material-icons text-sm">download</span> Export
              <span className="material-icons text-sm">expand_more</span>
            </button>
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden hidden group-hover:block z-50">
              {["csv", "excel", "pdf"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 uppercase font-medium"
                >
                  <span className="material-icons text-slate-400 text-base">
                    {fmt === "pdf"
                      ? "picture_as_pdf"
                      : fmt === "csv"
                        ? "description"
                        : "table_view"}
                  </span>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-4">
          {/* Period */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === opt.key
                    ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Source */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {[
              { key: "" as Source, label: "All sources", icon: "merge" },
              {
                key: "google_sheets" as Source,
                label: "Google Sheets",
                icon: "table_chart",
              },
              { key: "sipuni" as Source, label: "Sipuni", icon: "call" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSource(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  source === opt.key
                    ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
              >
                <span className="material-icons text-sm">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Sort by
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              title="Sort by"
              className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-20 flex flex-col items-center gap-3 text-slate-400">
            <span className="material-icons text-5xl">leaderboard</span>
            <p className="text-sm">
              No data yet. Calls need to be fully analyzed to appear here.
            </p>
          </div>
        ) : (
          <>
            <Podium data={data} />
            <ComparisonChart data={data} />
            <RankingsTable data={data} />
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default LeaderboardPage;
