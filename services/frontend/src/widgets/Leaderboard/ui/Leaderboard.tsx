import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { analyticsApi } from "../../../entities/analytics/api";
import { useUserStore } from "../../../entities/user/model/store";
import { Podium } from "./Podium";
import { RankingsTable } from "./RankingsTable";
import { ComparisonChart } from "./ComparisonChart";
import type { LeaderboardEntry, SortKey, Period, Source } from "../../../entities/analytics/types";

interface LeaderboardProps {
  teamId?: string;
  showFilters?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ teamId, showFilters = true }) => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();

  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [source, setSource] = useState<Source>("");
  const [sortBy, setSortBy] = useState<SortKey>("avg_kpi");
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveTeamId = teamId !== undefined ? teamId : currentTeamId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { sort_by: sortBy };
      if (effectiveTeamId) params.team_id = effectiveTeamId;
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
  }, [effectiveTeamId, period, source, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: string) => {
    try {
      const params: Record<string, unknown> = { sort_by: sortBy };
      if (effectiveTeamId) params.team_id = effectiveTeamId;
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
    { key: "avg_kpi", label: t("leaderboard.sort_options.avg_kpi") },
    { key: "avg_quality", label: t("leaderboard.sort_options.avg_quality") },
    { key: "avg_script_match", label: t("leaderboard.sort_options.avg_script_match") },
    { key: "avg_errors_free", label: t("leaderboard.sort_options.avg_errors_free") },
    { key: "total_calls", label: t("leaderboard.sort_options.total_calls") },
  ];

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: "7d", label: t("leaderboard.periods.7d") },
    { key: "30d", label: t("leaderboard.periods.30d") },
    { key: "90d", label: t("leaderboard.periods.90d") },
    { key: "", label: t("leaderboard.periods.all") },
  ];

  const filteredData = data.filter((m) =>
    m.manager_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t("leaderboard.title")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t("leaderboard.subtitle")}
          </p>
        </div>
        <div className="relative group">
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:opacity-90 transition-all">
            <span className="material-icons text-sm">download</span> {t("leaderboard.export")}
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

      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder={t("leaderboard.search_placeholder") || "Search manager..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary/20 rounded-lg text-sm transition-all outline-none"
            />
          </div>

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
              { key: "" as Source, label: t("leaderboard.sources.all"), icon: "merge" },
              {
                key: "google_sheets" as Source,
                label: t("leaderboard.sources.sheets"),
                icon: "table_chart",
              },
              { key: "sipuni" as Source, label: t("leaderboard.sources.sipuni"), icon: "call" },
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
              {t("leaderboard.sort_by")}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              title={t("leaderboard.sort_by")}
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
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-20 flex flex-col items-center gap-3 text-slate-400">
          <span className="material-icons text-5xl">leaderboard</span>
          <p className="text-sm text-center max-w-md px-6">
            {t("leaderboard.no_data")}
          </p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-20 flex flex-col items-center gap-3 text-slate-400">
          <span className="material-icons text-5xl">search_off</span>
          <p className="text-sm text-center max-w-md px-6">
            {t("leaderboard.no_results")}
          </p>
        </div>
      ) : (
        <>
          <Podium data={filteredData} />
          <ComparisonChart data={filteredData} />
          <RankingsTable data={filteredData} />
        </>
      )}
    </div>
  );
};
