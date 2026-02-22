import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsApi } from '../../../entities/analytics/api';
import { PageLayout } from '../../../widgets/PageLayout';
import Skeleton from '../../../shared/ui/Skeleton';
import { useUserStore } from '../../../entities/user/model/store';
import { SheetCalls } from '../../../widgets/SheetCalls';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManagerPerformance {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_kpi: number;
}

const DirectorDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();

  // Manager performance state
  const [managers, setManagers] = useState<ManagerPerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);

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

  // KPIs from manager analytics
  const totalCalls  = managers.reduce((a, m) => a + (m.total_calls || 0), 0);
  const avgQuality  = managers.length
    ? (managers.reduce((a, m) => a + (m.avg_quality || 0), 0) / managers.length).toFixed(1)
    : '0.0';

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
                { label: 'Sheet Calls', value: 'Active', sub: 'Google Sheets', icon: 'table_chart' },
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

          <SheetCalls />

        </div>
      </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
