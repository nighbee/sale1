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
import { QueueManagement } from "../../../features/QueueManagement";
import { CallFilters } from "../../../features/CallFilters";

type CallSource = "sipuni";

const CallMobileCard: React.FC<{ call: Call }> = ({ call }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
      <div className="flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {new Date(call.call_date).toLocaleString()}
        </p>
        <Link
          to={`/calls/${call.id}`}
          className="text-base font-bold text-slate-900 dark:text-white hover:text-primary transition-colors block"
        >
          {call.manager_name}
        </Link>
      </div>
      <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg text-xs font-bold ${
        call.quality_score && call.quality_score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
        call.quality_score && call.quality_score >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      }`}>
        {call.quality_score !== undefined ? call.quality_score : '—'}
      </span>
    </div>

    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center">
        <span className={`h-2 w-2 rounded-full mr-2 ${
            call.status === "completed" ? "bg-green-500" :
            call.status === "error" ? "bg-red-500" :
            "bg-yellow-500"
          }`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
            call.status === "completed" ? "text-green-600 dark:text-green-400" :
            call.status === "error" ? "text-red-600 dark:text-red-400" :
            "text-yellow-600 dark:text-yellow-400"
        }`}>
          {t(`calls.stats.${call.status}`)}
        </span>
      </div>
        <Link
          to={`/calls/${call.id}`}
          className="text-primary hover:text-primary-hover font-bold text-xs uppercase tracking-widest"
        >
          {t("calls.view")}
        </Link>
      </div>
    </div>
  );
};

const CallsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId, user } = useUserStore();
  const [source] = useState<CallSource>("sipuni");
  const [calls, setCalls] = useState<Call[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [status, setStatus] = useState<string>("completed");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
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
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

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
        if (status) {
          params.status = status;
        }
        if (debouncedSearch) {
          params.search = debouncedSearch;
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
  }, [currentTeamId, user, source, page, limit, selectedManager, status, debouncedSearch]);

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

        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
                { label: t("dashboard.total_calls"), value: stats.total, icon: 'call', color: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                { label: t("calls.stats.completed"), value: stats.completed, icon: 'check_circle', color: 'green', bg: 'bg-green-50 dark:bg-green-900/10' },
                { label: t("calls.stats.pending"), value: stats.pending, icon: 'pending', color: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-900/10' },
                { label: t("calls.stats.processing"), value: stats.processing, icon: 'sync', color: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
                { label: t("calls.stats.error"), value: stats.error, icon: 'error_outline', color: 'red', bg: 'bg-red-50 dark:bg-red-900/10' },
                { label: t("dashboard.avg_quality"), value: stats.avgScore, icon: 'analytics', color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
            ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl ${s.bg} text-${s.color}-600 dark:text-${s.color}-400 group-hover:scale-110 transition-transform duration-300`}>
                          <span className="material-icons text-xl block">{s.icon}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-tight">
                            {s.label}
                        </p>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{s.value}</p>
                </div>
            ))}
        </div>

        {(user?.role === 'super_admin' || user?.role === 'tenant_admin') && (
          <QueueManagement />
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-6 lg:items-end justify-between">
            <CallFilters
              search={search}
              onSearchChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              managerId={selectedManager}
              onManagerChange={(val) => {
                setSelectedManager(val);
                setPage(1);
              }}
              status={status}
              onStatusChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
              managers={managers}
              showManagerFilter={user?.role !== 'sales_rep'}
            />

            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700 w-fit">
                {t('pagination.showing')} {(page-1)*limit + 1} - {Math.min(page*limit, totalResults)} {t('pagination.of')} {totalResults}
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.datetime")}
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.representative")}
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.analysis_time")}
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.score")}
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("calls.status")}
                  </th>
                  <th className="relative px-6 py-4 w-24"></th>
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
                        <td className="px-6 py-4"></td>
                      </tr>
                    ))
                  : calls.map((call) => (
                      <tr
                        key={call.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                          {new Date(call.call_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link to={`/calls/${call.id}`} className="text-sm font-bold text-slate-900 dark:text-white hover:text-primary transition-colors">
                            {call.manager_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                          {call.analysis_time !== undefined ? `${call.analysis_time}s` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ${
                            call.quality_score && call.quality_score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            call.quality_score && call.quality_score >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {call.quality_score !== undefined ? call.quality_score : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`h-2 w-2 rounded-full mr-2 shadow-sm ${
                                call.status === "completed" ? "bg-green-500 shadow-green-500/20" :
                                call.status === "error" ? "bg-red-500 shadow-red-500/20" :
                                "bg-yellow-500 shadow-yellow-500/20"
                              }`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                call.status === "completed" ? "text-green-600 dark:text-green-400" :
                                call.status === "error" ? "text-red-600 dark:text-red-400" :
                                "text-yellow-600 dark:text-yellow-400"
                            }`}>
                              {t(`calls.stats.${call.status}`)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            to={`/calls/${call.id}`}
                            className="inline-flex items-center text-primary hover:text-primary-hover font-bold text-[10px] uppercase tracking-widest border border-primary/20 hover:border-primary/50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            {t("calls.view")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                {!loading && calls.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-20 text-slate-500 text-sm font-bold uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">
                      {t("calls.no_calls")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-4">
            {loading
              ? [1, 2, 3].map(i => (
                  <div key={i} className="space-y-3 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-48" />
                    <div className="flex justify-between pt-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))
              : calls.map(call => (
                  <CallMobileCard key={call.id} call={call} />
                ))
            }
            {!loading && calls.length === 0 && (
               <div className="text-center py-12 text-slate-500 text-sm font-bold uppercase tracking-widest">
                  {t("calls.no_calls")}
               </div>
            )}
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
