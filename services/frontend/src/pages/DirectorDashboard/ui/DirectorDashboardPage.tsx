import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import { analyticsApi } from '../../../entities/analytics/api';
import { callApi } from '../../../entities/call/api';
import { integrationApi } from '../../../entities/integration/api';
import { PageLayout } from '../../../widgets/PageLayout';
import Skeleton from '../../../shared/ui/Skeleton';
import { useUserStore } from '../../../entities/user/model/store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManagerPerformance {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_kpi: number;
}

interface SheetCall {
  id: string;
  manager_name: string;
  client_phone: string;
  call_date: string;
  duration: number;
  status: string;
  call_link?: string;
  quality_score?: number;
  script_match?: number;
  errors_free?: number;
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  error:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const ScoreBar: React.FC<{ value?: number }> = ({ value }) => {
  if (value == null) return <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
  const color = value >= 90 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-7">{value}</span>
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-16">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

// ── Export helpers ─────────────────────────────────────────────────────────────

function buildExportRows(calls: SheetCall[]) {
  return calls.map(c => ({
    Date: c.call_date ? new Date(c.call_date).toLocaleDateString() : '',
    Manager: c.manager_name || '',
    Client: c.client_phone || '',
    Duration: c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : '',
    Status: c.status,
    Quality: c.quality_score ?? '',
    'Script Match': c.script_match ?? '',
    'Errors Free': c.errors_free ?? '',
  }));
}

function exportCSV(calls: SheetCall[]) {
  const rows = buildExportRows(calls);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sheet_calls_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportXlsx(calls: SheetCall[]) {
  const rows = buildExportRows(calls);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet Calls');
  XLSX.writeFile(wb, `sheet_calls_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const CHART_COLORS = { quality: '#6366f1', script: '#10b981', errors: '#f59e0b' };

// ── Component ─────────────────────────────────────────────────────────────────

const DirectorDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTeamId } = useUserStore();

  // Manager performance state
  const [managers, setManagers] = useState<ManagerPerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);

  // Sheet calls — load full filtered set (up to 500) for charts + client-side pagination
  const [allSheetCalls, setAllSheetCalls] = useState<SheetCall[]>([]);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter]   = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [clientFilter, setClientFilter]   = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');

  // Table page
  const [tablePage, setTablePage] = useState(1);

  // ── Analytics fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setPerfLoading(true);
      try {
        const res = await analyticsApi.getTeamPerformance({ period: 'last_30_days', team_id: currentTeamId });
        const data = res.data as { managers?: ManagerPerformance[] };
        setManagers(data.managers || []);
      } catch {
        console.error('Failed to fetch performance data');
      } finally {
        setPerfLoading(false);
      }
    };
    run();
  }, [currentTeamId]);

  // ── Sheet calls fetch ─────────────────────────────────────────────────────
  const fetchSheetCalls = useCallback(async () => {
    setSheetLoading(true);
    try {
      const params: Record<string, unknown> = { source: 'google_sheets', limit: 500, page: 1 };
      if (statusFilter)  params.status       = statusFilter;
      if (managerFilter) params.manager_name = managerFilter;
      if (clientFilter)  params.client_phone = clientFilter;
      if (dateFrom)      params.date_from    = dateFrom;
      if (dateTo)        params.date_to      = dateTo;

      const res = await callApi.listCalls(params);
      setAllSheetCalls((res.data.calls || []) as SheetCall[]);
    } catch {
      console.error('Failed to fetch sheet calls');
    } finally {
      setSheetLoading(false);
    }
  }, [statusFilter, managerFilter, clientFilter, dateFrom, dateTo]);

  useEffect(() => {
    setTablePage(1);
    fetchSheetCalls();
  }, [fetchSheetCalls]);

  // ── Sync trigger ──────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      await integrationApi.triggerSheetSync();
      toast.success('Sync triggered — results will appear shortly');
      setTimeout(fetchSheetCalls, 3000);
    } catch {
      toast.error('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueManagers = useMemo(() =>
    [...new Set(allSheetCalls.map(c => c.manager_name).filter(Boolean))].sort(),
    [allSheetCalls]
  );

  const totalPages = Math.ceil(allSheetCalls.length / PAGE_SIZE);
  const tableRows  = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE;
    return allSheetCalls.slice(start, start + PAGE_SIZE);
  }, [allSheetCalls, tablePage]);

  // Line chart: score trends over time (completed calls)
  const qualityOverTime = useMemo(() =>
    allSheetCalls
      .filter(c => c.status === 'completed' && c.quality_score != null && c.call_date)
      .sort((a, b) => a.call_date.localeCompare(b.call_date))
      .map(c => ({
        date: new Date(c.call_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        quality: c.quality_score,
        script:  c.script_match,
        errors:  c.errors_free,
      })),
    [allSheetCalls]
  );

  // Bar chart: avg per manager
  const perManagerAvg = useMemo(() => {
    const map: Record<string, { quality: number[]; script: number[]; errors: number[] }> = {};
    for (const c of allSheetCalls) {
      if (c.status !== 'completed') continue;
      const name = c.manager_name || 'Unknown';
      if (!map[name]) map[name] = { quality: [], script: [], errors: [] };
      if (c.quality_score != null) map[name].quality.push(c.quality_score);
      if (c.script_match  != null) map[name].script.push(c.script_match);
      if (c.errors_free   != null) map[name].errors.push(c.errors_free);
    }
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return Object.entries(map).map(([manager, v]) => ({
      manager: manager.length > 12 ? manager.slice(0, 12) + '…' : manager,
      quality: avg(v.quality),
      script:  avg(v.script),
      errors:  avg(v.errors),
    }));
  }, [allSheetCalls]);

  const showCharts = qualityOverTime.length > 0 || perManagerAvg.length > 0;

  // KPIs from manager analytics
  const totalCalls  = managers.reduce((a, m) => a + (m.total_calls || 0), 0);
  const avgQuality  = managers.length
    ? (managers.reduce((a, m) => a + (m.avg_quality || 0), 0) / managers.length).toFixed(1)
    : '0.0';
  const sheetTotal     = allSheetCalls.length;
  const sheetCompleted = allSheetCalls.filter(c => c.status === 'completed').length;
  const sheetErrored   = allSheetCalls.filter(c => c.status === 'error').length;

  const hasActiveFilters = !!(statusFilter || managerFilter || clientFilter || dateFrom || dateTo);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout title={t('dashboard.title')}>
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* ── KPI cards ────────────────────────────────────────────────── */}
          {perfLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <Skeleton className="h-10 w-10 mb-4" />
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: t('dashboard.total_calls'), value: totalCalls, icon: 'phone_in_talk' },
                { label: t('dashboard.avg_quality'),  value: avgQuality,  icon: 'analytics' },
                { label: t('dashboard.active_teams'), value: managers.length, sub: t('dashboard.managers'), icon: 'groups' },
                { label: 'Sheet Calls', value: sheetTotal, sub: `${sheetCompleted} done · ${sheetErrored} err`, icon: 'table_chart' },
              ].map(m => (
                <div key={m.label} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary inline-block">
                      <span className="material-icons text-xl">{m.icon}</span>
                    </div>
                  </div>
                  <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{m.label}</h3>
                  <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                    {m.value}{' '}
                    {m.sub && <span className="text-base font-normal text-slate-500">{m.sub}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Manager performance table ─────────────────────────────────── */}
          {!perfLoading && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-primary-dark dark:text-white">{t('dashboard.manager_performance')}</h2>
                <button className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 transition-colors">
                  {t('dashboard.view_full_report')} <span className="material-icons text-sm">arrow_forward</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-4 font-semibold">{t('dashboard.manager')}</th>
                      <th className="px-6 py-4 text-center">{t('dashboard.calls')}</th>
                      <th className="px-6 py-4">{t('dashboard.quality')}</th>
                      <th className="px-6 py-4">{t('dashboard.script_match')}</th>
                      <th className="px-6 py-4 text-right">{t('dashboard.kpi')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {managers.map(m => (
                      <tr key={m.manager_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {m.manager_name?.[0]}
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-200">{m.manager_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block py-1 px-2 bg-slate-100 dark:bg-slate-700 rounded text-sm font-semibold text-slate-600 dark:text-slate-300">
                            {m.total_calls}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-8">{(m.avg_quality || 0).toFixed(1)}</span>
                            <div className="flex-1 h-1.5 w-16 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.avg_quality}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">{(m.avg_script_match || 0).toFixed(0)}%</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold">{(m.avg_kpi || 0).toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Google Sheets section ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">

            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="material-icons text-emerald-500 text-2xl">table_chart</span>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Google Sheets Calls</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{sheetTotal} calls · AI pipeline</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => exportCSV(allSheetCalls)}
                  disabled={!allSheetCalls.length}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <span className="material-icons text-sm">download</span> CSV
                </button>
                <button
                  onClick={() => exportXlsx(allSheetCalls)}
                  disabled={!allSheetCalls.length}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <span className="material-icons text-sm">download</span> Excel
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <span className={`material-icons text-base ${syncing ? 'animate-spin' : ''}`}>
                    {syncing ? 'sync' : 'cloud_sync'}
                  </span>
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 items-end">
              {/* Status pills */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status</label>
                <div className="flex gap-1 flex-wrap">
                  {['', 'completed', 'error', 'processing', 'pending'].map(s => (
                    <button
                      key={s || 'all'}
                      onClick={() => { setStatusFilter(s); setTablePage(1); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        statusFilter === s
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                      }`}
                    >
                      {s || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manager dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manager</label>
                <select
                  value={managerFilter}
                  title="Filter by manager"
                  onChange={e => { setManagerFilter(e.target.value); setTablePage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All managers</option>
                  {uniqueManagers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Client phone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Client phone</label>
                <input
                  type="text"
                  value={clientFilter}
                  onChange={e => { setClientFilter(e.target.value); setTablePage(1); }}
                  placeholder="Search phone…"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                />
              </div>

              {/* Date from */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Date from</label>
                <input
                  type="date"
                  value={dateFrom}
                  title="Start date"
                  onChange={e => { setDateFrom(e.target.value); setTablePage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date to */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Date to</label>
                <input
                  type="date"
                  value={dateTo}
                  title="End date"
                  onChange={e => { setDateTo(e.target.value); setTablePage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setStatusFilter(''); setManagerFilter(''); setClientFilter('');
                    setDateFrom(''); setDateTo(''); setTablePage(1);
                  }}
                  className="self-end flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-icons text-sm">close</span>Clear filters
                </button>
              )}
            </div>

            {/* Charts */}
            {!sheetLoading && showCharts && (
              <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-700 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Score trends over time */}
                {qualityOverTime.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Score trends over time</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={qualityOverTime} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} />
                        <Line type="monotone" dataKey="quality" name="Quality"     stroke={CHART_COLORS.quality} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="script"  name="Script"      stroke={CHART_COLORS.script}  strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="errors"  name="Errors Free" stroke={CHART_COLORS.errors}  strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Average scores per manager */}
                {perManagerAvg.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Average scores per manager</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={perManagerAvg} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="manager" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} />
                        <Bar dataKey="quality" name="Quality"     fill={CHART_COLORS.quality} radius={[3,3,0,0]} />
                        <Bar dataKey="script"  name="Script"      fill={CHART_COLORS.script}  radius={[3,3,0,0]} />
                        <Bar dataKey="errors"  name="Errors Free" fill={CHART_COLORS.errors}  radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Manager</th>
                    <th className="px-6 py-3 font-semibold">Client</th>
                    <th className="px-6 py-3 font-semibold">Duration</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Quality</th>
                    <th className="px-6 py-3 font-semibold">Script</th>
                    <th className="px-6 py-3 font-semibold">Errors Free</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {sheetLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 9 }).map((__, j) => (
                            <td key={j} className="px-6 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    : tableRows.length === 0
                      ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                            <span className="material-icons text-3xl block mb-2 opacity-30">cloud_off</span>
                            No calls found. {hasActiveFilters ? 'Try adjusting filters.' : 'Click Sync Now to import from Google Sheets.'}
                          </td>
                        </tr>
                      )
                      : tableRows.map(call => (
                        <tr
                          key={call.id}
                          onClick={() => navigate(`/calls/${call.id}`)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {call.call_date ? new Date(call.call_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {call.manager_name?.[0] || '?'}
                              </div>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{call.manager_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{call.client_phone || '—'}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[call.status] || STATUS_PILL.pending}`}>
                              {call.status}
                            </span>
                          </td>
                          <td className="px-6 py-3"><ScoreBar value={call.quality_score} /></td>
                          <td className="px-6 py-3"><ScoreBar value={call.script_match} /></td>
                          <td className="px-6 py-3"><ScoreBar value={call.errors_free} /></td>
                          <td className="px-6 py-3 text-right">
                            <span className="material-icons text-slate-400 text-base">chevron_right</span>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>
                  {((tablePage - 1) * PAGE_SIZE) + 1}–{Math.min(tablePage * PAGE_SIZE, allSheetCalls.length)} of {allSheetCalls.length}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    disabled={tablePage === 1}
                    onClick={() => setTablePage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg = totalPages <= 7 ? i + 1
                      : tablePage <= 4 ? i + 1
                      : tablePage >= totalPages - 3 ? totalPages - 6 + i
                      : tablePage - 3 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setTablePage(pg)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          tablePage === pg
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    disabled={tablePage === totalPages}
                    onClick={() => setTablePage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
