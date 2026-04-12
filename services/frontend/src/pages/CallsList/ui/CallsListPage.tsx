import React, { useState, useEffect } from "react";
import { PageLayout } from "../../../widgets/PageLayout";
import { callApi } from "../../../entities/call/api";
import { userApi } from "../../../entities/user/api";
import type { User } from "../../../entities/user/types";
import type { Call, ListCallsResponse } from "../../../entities/call/types";
import Skeleton from "../../../shared/ui/Skeleton";
import Pagination from "../../../shared/ui/Pagination";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserStore } from "../../../entities/user/model/store";

type CallSource = "sipuni" | "google_sheets";

const CallsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId, user } = useUserStore();
  const [source, setSource] = useState<CallSource>("google_sheets");
  const [calls, setCalls] = useState<Call[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: 0,
    completed: 0,
    pending: 0,
    processing: 0,
    error: 0
  });

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await userApi.listUsers();
        setManagers(res.data.users || []);
      } catch (err) {
        console.error("Failed to fetch managers", err);
      }
    };
    fetchManagers();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = {
          source,
          page,
          limit
        };
        if (currentTeamId) {
          params.team_id = currentTeamId;
        }
        if (selectedManager) {
          params.manager_id = selectedManager;
        }

        let res;
        if (user?.role === 'sales_rep' && user.id) {
          res = await userApi.getUserCalls(user.id, params);
        } else {
          res = await callApi.listCalls(params);
        }

        const data = res.data as ListCallsResponse;
        setCalls(data.calls || []);
        const total = data.total || 0;
        setTotalResults(total);
        setTotalPages(Math.ceil(total / limit));

        const callsWithScore = (data.calls || []).filter(c => c.quality_score !== undefined);
        const avg = callsWithScore.length > 0
          ? callsWithScore.reduce((sum, c) => sum + (c.quality_score || 0), 0) / callsWithScore.length
          : 0;

        setStats({
          total,
          avgScore: parseFloat(avg.toFixed(1)),
          completed: data.status_counts?.completed || 0,
          pending: data.status_counts?.pending || 0,
          processing: data.status_counts?.processing || 0,
          error: data.status_counts?.error || 0
        });
      } catch {
        console.error("Failed to fetch calls");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentTeamId, user, source, page, limit, selectedManager]);

  return (
    <PageLayout title={t("calls.list_title")}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t("calls.list_title")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("calls.list_subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             <button
              onClick={() => { setSource("sipuni"); setPage(1); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                source === "sipuni"
                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t('calls.sources.sipuni')}
            </button>
            <button
              onClick={() => { setSource("google_sheets"); setPage(1); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                source === "google_sheets"
                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t('calls.sources.sheets')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
                { label: t("dashboard.total_calls"), value: stats.total, icon: 'call', color: 'blue' },
                { label: t("calls.stats.completed"), value: stats.completed, icon: 'check_circle', color: 'green' },
                { label: t("calls.stats.pending"), value: stats.pending, icon: 'pending', color: 'yellow' },
                { label: t("calls.stats.processing"), value: stats.processing, icon: 'sync', color: 'indigo' },
                { label: t("calls.stats.error"), value: stats.error, icon: 'error_outline', color: 'red' },
                { label: t("dashboard.avg_quality"), value: stats.avgScore, icon: 'analytics', color: 'emerald' },
            ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className={`material-icons text-lg text-${s.color}-500`}>{s.icon}</span>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate">
                            {s.label}
                        </p>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{s.value}</p>
                </div>
            ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <span className="material-icons text-sm">search</span>
                </span>
                <input
                  className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  placeholder={t("calls.search")}
                  type="text"
                />
              </div>

              {user?.role !== 'sales_rep' && (
                <div className="w-full md:w-64">
                  <select
                    value={selectedManager}
                    onChange={(e) => {
                      setSelectedManager(e.target.value);
                      setPage(1);
                    }}
                    className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="">{t("calls.all_managers") || "All Managers"}</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.manager_id}>
                        {m.first_name || m.username || m.email} {m.last_name || ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
                {t('common.showing')} {(page-1)*limit + 1} - {Math.min(page*limit, totalResults)} {t('common.of')} {totalResults}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.datetime")}
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.representative")}
                  </th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.score")}
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.status")}
                  </th>
                  <th className="relative px-6 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading
                  ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                      </tr>
                    ))
                  : calls.map((call) => (
                      <tr
                        key={call.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                          {new Date(call.call_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white">
                          <Link to={`/calls/${call.id}`} className="hover:text-primary transition-colors">
                            {call.manager_name}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded text-xs font-bold ${
                            call.quality_score && call.quality_score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            call.quality_score && call.quality_score >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {call.quality_score !== undefined ? call.quality_score : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`h-1.5 w-1.5 rounded-full mr-2 ${
                                call.status === "completed" ? "bg-green-500" :
                                call.status === "error" ? "bg-red-500" :
                                "bg-yellow-500"
                              }`} />
                            <span className={`text-xs font-medium uppercase tracking-tight ${
                                call.status === "completed" ? "text-green-600 dark:text-green-400" :
                                call.status === "error" ? "text-red-600 dark:text-red-400" :
                                "text-yellow-600 dark:text-yellow-400"
                            }`}>
                              {call.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                          <Link
                            to={`/calls/${call.id}`}
                            className="text-primary hover:text-primary-hover font-bold text-xs uppercase tracking-wider"
                          >
                            {t("calls.view")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                {!loading && calls.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500 text-sm font-medium">
                      {t("calls.no_calls")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalResults={totalResults}
                limit={limit}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default CallsListPage;
