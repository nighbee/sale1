import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
import { analyticsApi } from '../../../entities/analytics/api';
import { useUserStore } from '../../../entities/user/model/store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

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

type SortKey = 'avg_kpi' | 'avg_quality' | 'avg_script_match' | 'avg_errors_free' | 'total_calls';
type Period = '' | '7d' | '30d' | '90d';
type Source = '' | 'google_sheets' | 'sipuni';

const MEDAL_BG = ['bg-amber-400', 'bg-slate-400', 'bg-orange-400'];
const MEDAL_LABELS = ['🥇', '🥈', '🥉'];
const CHART_COLORS = { quality: '#6366f1', script: '#10b981', errors: '#f59e0b', kpi: '#3b82f6' };
const BAR_COLOR = { quality: 'bg-indigo-500', script: 'bg-emerald-500', errors: 'bg-amber-400' };
const TEXT_COLOR = { quality: 'text-indigo-500', script: 'text-emerald-500', errors: 'text-amber-500' };

function ScoreBar({ value, bar, text }: { value: number; bar: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${text}`}>{value.toFixed(0)}</span>
    </div>
  );
}

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();

  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [source, setSource] = useState<Source>('');
  const [sortBy, setSortBy] = useState<SortKey>('avg_kpi');

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
      console.error('Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, period, source, sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (format: string) => {
    try {
      const params: Record<string, unknown> = { sort_by: sortBy };
      if (currentTeamId) params.team_id = currentTeamId;
      if (period) params.period = period;
      if (source) params.source = source;
      const res = await analyticsApi.exportLeaderboard(format, params);
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leaderboard.${format === 'excel' ? 'xlsx' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const topThree = data.slice(0, 3);

  const chartData = useMemo(() =>
    data.slice(0, 10).map(m => ({
      name: m.manager_name?.length > 10 ? m.manager_name.slice(0, 10) + '…' : m.manager_name,
      Quality:  +m.avg_quality.toFixed(1),
      Script:   +m.avg_script_match.toFixed(1),
      Errors:   +m.avg_errors_free.toFixed(1),
    })),
    [data]
  );

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'avg_kpi',          label: 'KPI Score' },
    { key: 'avg_quality',      label: 'Quality' },
    { key: 'avg_script_match', label: 'Script Match' },
    { key: 'avg_errors_free',  label: 'Errors Free' },
    { key: 'total_calls',      label: 'Calls Count' },
  ];

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: '7d',  label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
    { key: '',    label: 'All time' },
  ];

  return (
    <PageLayout title={t('leaderboard.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('leaderboard.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('leaderboard.subtitle')}</p>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:opacity-90 transition-all">
              <span className="material-icons text-sm">download</span> Export
              <span className="material-icons text-sm">expand_more</span>
            </button>
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden hidden group-hover:block z-50">
              {['csv', 'excel', 'pdf'].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 uppercase font-medium">
                  <span className="material-icons text-slate-400 text-base">
                    {fmt === 'pdf' ? 'picture_as_pdf' : fmt === 'csv' ? 'description' : 'table_view'}
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
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === opt.key
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Source */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {[
              { key: '' as Source,              label: 'All sources',   icon: 'merge' },
              { key: 'google_sheets' as Source, label: 'Google Sheets', icon: 'table_chart' },
              { key: 'sipuni' as Source,        label: 'Sipuni',        icon: 'call' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setSource(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  source === opt.key
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}>
                <span className="material-icons text-sm">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Sort by</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} title="Sort by"
              className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
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
            <p className="text-sm">No data yet. Calls need to be fully analyzed to appear here.</p>
          </div>
        ) : (
          <>
            {/* ── Podium ── */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                {/* 2nd */}
                {topThree[1] ? (
                  <div className="order-2 md:order-1">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
                      <div className="relative mb-3">
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${MEDAL_BG[1]}`}>
                          {topThree[1].manager_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 text-lg">{MEDAL_LABELS[1]}</div>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{topThree[1].manager_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{topThree[1].total_calls} calls</p>
                      <div className="mt-4 w-full space-y-2">
                        <ScoreBar value={topThree[1].avg_quality}      bar={BAR_COLOR.quality} text={TEXT_COLOR.quality} />
                        <ScoreBar value={topThree[1].avg_script_match} bar={BAR_COLOR.script}  text={TEXT_COLOR.script} />
                        <ScoreBar value={topThree[1].avg_errors_free}  bar={BAR_COLOR.errors}  text={TEXT_COLOR.errors} />
                      </div>
                      <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 w-full">
                        <div className="text-2xl font-bold text-primary">{topThree[1].avg_kpi.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">KPI Score</div>
                      </div>
                    </div>
                  </div>
                ) : <div className="order-2 md:order-1" />}

                {/* 1st */}
                <div className="order-1 md:order-2 md:-mt-6 relative">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">
                    <span className="material-icons text-4xl">emoji_events</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-lg border-2 border-primary/20 flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      <div className={`h-20 w-20 rounded-full ring-4 ring-yellow-400/30 flex items-center justify-center text-white font-black text-2xl ${MEDAL_BG[0]}`}>
                        {topThree[0].manager_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 text-xl">{MEDAL_LABELS[0]}</div>
                    </div>
                    <p className="font-bold text-lg text-slate-900 dark:text-white">{topThree[0].manager_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{topThree[0].total_calls} calls · {topThree[0].total_duration_minutes.toFixed(0)} min</p>
                    <div className="mt-5 w-full space-y-2">
                      <ScoreBar value={topThree[0].avg_quality}      bar={BAR_COLOR.quality} text={TEXT_COLOR.quality} />
                      <ScoreBar value={topThree[0].avg_script_match} bar={BAR_COLOR.script}  text={TEXT_COLOR.script} />
                      <ScoreBar value={topThree[0].avg_errors_free}  bar={BAR_COLOR.errors}  text={TEXT_COLOR.errors} />
                    </div>
                    <div className="mt-5 bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 w-full">
                      <div className="text-4xl font-black text-primary tracking-tight">{topThree[0].avg_kpi.toFixed(1)}</div>
                      <div className="text-sm text-slate-500 font-medium">KPI Score</div>
                    </div>
                  </div>
                </div>

                {/* 3rd */}
                {topThree[2] ? (
                  <div className="order-3 md:order-3">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
                      <div className="relative mb-3">
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${MEDAL_BG[2]}`}>
                          {topThree[2].manager_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 text-lg">{MEDAL_LABELS[2]}</div>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{topThree[2].manager_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{topThree[2].total_calls} calls</p>
                      <div className="mt-4 w-full space-y-2">
                        <ScoreBar value={topThree[2].avg_quality}      bar={BAR_COLOR.quality} text={TEXT_COLOR.quality} />
                        <ScoreBar value={topThree[2].avg_script_match} bar={BAR_COLOR.script}  text={TEXT_COLOR.script} />
                        <ScoreBar value={topThree[2].avg_errors_free}  bar={BAR_COLOR.errors}  text={TEXT_COLOR.errors} />
                      </div>
                      <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 w-full">
                        <div className="text-2xl font-bold text-primary">{topThree[2].avg_kpi.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">KPI Score</div>
                      </div>
                    </div>
                  </div>
                ) : <div className="order-3 md:order-3" />}
              </div>
            )}

            {/* ── Bar chart ── */}
            {chartData.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Average scores — top {chartData.length}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconType="circle" iconSize={8} />
                    <Bar dataKey="Quality" fill={CHART_COLORS.quality} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Script"  fill={CHART_COLORS.script}  radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Errors"  fill={CHART_COLORS.errors}  radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Full Rankings Table ── */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Full Rankings</h3>
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
                      <tr key={m.manager_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            i === 0 ? 'bg-yellow-100 text-yellow-700' :
                            i === 1 ? 'bg-slate-200 text-slate-600' :
                            i === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>{i + 1}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {m.manager_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white text-sm">{m.manager_name}</p>
                              <p className="text-xs text-slate-400">ID: {m.manager_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-0.5 text-xs font-semibold">{m.total_calls}</span>
                        </td>
                        <td className="px-5 py-4 text-center text-xs text-slate-500">
                          {m.total_duration_minutes >= 60
                            ? `${(m.total_duration_minutes / 60).toFixed(1)}h`
                            : `${m.total_duration_minutes.toFixed(0)}m`}
                        </td>
                        <td className="px-5 py-4"><ScoreBar value={m.avg_quality}      bar={BAR_COLOR.quality} text={TEXT_COLOR.quality} /></td>
                        <td className="px-5 py-4"><ScoreBar value={m.avg_script_match} bar={BAR_COLOR.script}  text={TEXT_COLOR.script} /></td>
                        <td className="px-5 py-4"><ScoreBar value={m.avg_errors_free}  bar={BAR_COLOR.errors}  text={TEXT_COLOR.errors} /></td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-black text-primary text-base">{m.avg_kpi.toFixed(1)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default LeaderboardPage;


interface LeaderboardEntry {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_kpi: number;
}

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await analyticsApi.getLeaderboard({ team_id: currentTeamId });
        const responseData = res.data as { leaderboard?: LeaderboardEntry[] };
        setData(responseData.leaderboard || []);
      } catch {
        console.error('Failed to fetch leaderboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentTeamId]);

  const handleExport = async (format: string) => {
      try {
          const res = await analyticsApi.exportLeaderboard(format, { team_id: currentTeamId });
          const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `leaderboard.${format === 'excel' ? 'xlsx' : format}`);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          console.error("Export failed", err);
      }
  }

  const topThree = data.slice(0, 3);

  return (
    <PageLayout title={t('leaderboard.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('leaderboard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all">
                    <span className="material-icons text-sm">download</span> {t('leaderboard.export')}
                    <span className="material-icons text-sm">expand_more</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden hidden group-hover:block z-50">
                    {['pdf', 'csv', 'excel'].map((format) => (
                        <button
                            key={format}
                            onClick={() => handleExport(format)}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 uppercase font-medium"
                        >
                            <span className="material-icons text-slate-400 text-lg">
                                {format === 'pdf' ? 'picture_as_pdf' : format === 'csv' ? 'description' : 'table_view'}
                            </span>
                            {format}
                        </button>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="order-2 md:order-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="h-20 w-20 rounded-full p-1 bg-gradient-to-b from-slate-300 to-slate-100">
                          <div className="h-full w-full rounded-full bg-slate-400 flex items-center justify-center text-white font-bold">{topThree[1].manager_name?.[0]}</div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 text-slate-600 font-bold text-xs">2</div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{topThree[1].manager_name}</h3>
                      <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700 mt-4">
                        <div className="text-3xl font-bold text-primary">{(topThree[1].avg_kpi || 0).toFixed(1)}</div>
                        <div className="text-xs text-slate-500 mt-1">{t('leaderboard.overall_score')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* 1st Place */}
              {topThree[0] && (
                <div className="order-1 md:order-2 flex flex-col -mt-6 md:-mt-12 relative z-10">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-yellow-500 animate-bounce">
                    <span className="material-icons text-4xl">emoji_events</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-lg border border-primary/20 relative overflow-hidden">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-5">
                        <div className="h-24 w-24 rounded-full p-1 bg-gradient-to-b from-yellow-300 to-yellow-100 ring-4 ring-primary/10">
                          <div className="h-full w-full rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold text-2xl">{topThree[0].manager_name?.[0]}</div>
                        </div>
                        <div className="absolute -bottom-3 -right-1 h-10 w-10 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 text-yellow-900 font-black text-sm">1</div>
                      </div>
                      <h3 className="font-bold text-xl text-slate-900 dark:text-white">{topThree[0].manager_name}</h3>
                      <div className="w-full bg-primary/5 rounded-lg p-4 border border-primary/10 mt-5">
                        <div className="text-5xl font-bold text-primary tracking-tight">{(topThree[0].avg_kpi || 0).toFixed(1)}</div>
                        <div className="text-sm text-slate-500 mt-1 font-medium">{t('leaderboard.overall_score')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* 3rd Place */}
              {topThree[2] && (
                <div className="order-3 md:order-3 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="h-20 w-20 rounded-full p-1 bg-gradient-to-b from-orange-300 to-orange-100">
                          <div className="h-full w-full rounded-full bg-orange-400 flex items-center justify-center text-white font-bold">{topThree[2].manager_name?.[0]}</div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-orange-300 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 text-orange-900 font-bold text-xs">3</div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{topThree[2].manager_name}</h3>
                      <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700 mt-4">
                        <div className="text-3xl font-bold text-primary">{(topThree[2].avg_kpi || 0).toFixed(1)}</div>
                        <div className="text-xs text-slate-500 mt-1">{t('leaderboard.overall_score')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('leaderboard.full_rankings')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                      <th className="px-6 py-4">{t('leaderboard.rank')}</th>
                      <th className="px-6 py-4">{t('calls.representative')}</th>
                      <th className="px-6 py-4 text-center">{t('dashboard.calls')}</th>
                      <th className="px-6 py-4">{t('dashboard.avg_quality')}</th>
                      <th className="px-6 py-4">{t('leaderboard.overall_score')}</th>
                      <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.map((m, index) => (
                      <tr key={m.manager_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">{m.manager_name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">{m.total_calls}</td>
                        <td className="px-6 py-4">{(m.avg_quality || 0).toFixed(1)}</td>
                        <td className="px-6 py-4 font-bold">{(m.avg_kpi || 0).toFixed(1)}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:underline text-sm">{t('leaderboard.view_details')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default LeaderboardPage;
