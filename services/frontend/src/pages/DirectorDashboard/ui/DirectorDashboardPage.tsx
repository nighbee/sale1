import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsApi } from '../../../entities/analytics/api';
import { PageLayout } from '../../../widgets/PageLayout';
import Skeleton from '../../../shared/ui/Skeleton';
import { useUserStore } from '../../../entities/user/model/store';

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
  const [managers, setManagers] = useState<ManagerPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await analyticsApi.getTeamPerformance({ period: 'last_30_days', team_id: currentTeamId });
        const data = response.data as { managers?: ManagerPerformance[] };
        setManagers(data.managers || []);
      } catch {
        console.error("Failed to fetch performance data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentTeamId]);

  const totalCalls = managers.reduce((acc, m) => acc + (m.total_calls || 0), 0);
  const avgQuality = managers.length > 0
    ? (managers.reduce((acc, m) => acc + (m.avg_quality || 0), 0) / managers.length).toFixed(1)
    : '0.0';

  return (
    <PageLayout title={t('dashboard.title')}>
        <div className="p-4 md:p-8">
          <div className="flex justify-end mb-6 md:-mt-14 relative z-20">
            <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
              <span className="material-icons text-lg text-slate-400">calendar_today</span>
              <span className="hidden sm:inline">{t('dashboard.last_30_days')}</span>
              <span className="material-icons text-lg text-slate-400">expand_more</span>
            </button>
          </div>
          {loading ? (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Skeleton className="h-10 w-10 mb-4" />
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                 <Skeleton className="h-6 w-48 mb-6" />
                 <div className="space-y-4">
                   {[1, 2, 3, 4, 5].map((i) => (
                     <Skeleton key={i} className="h-12 w-full" />
                   ))}
                 </div>
              </div>
            </div>
          ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: t('dashboard.total_calls'), value: totalCalls, trend: '+12%', icon: 'phone_in_talk', color: 'blue' },
                { label: t('dashboard.avg_quality'), value: avgQuality, trend: '+2.1', icon: 'analytics', color: 'purple' },
                { label: t('dashboard.active_teams'), value: managers.length, subValue: t('dashboard.managers'), icon: 'groups', color: 'indigo' },
                { label: t('dashboard.pending_analysis'), value: '3', subValue: t('dashboard.pending'), icon: 'hourglass_top', color: 'orange', status: t('dashboard.processing') },
              ].map((metric) => (
                <div key={metric.label} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                      <span className="material-icons text-xl">{metric.icon}</span>
                    </div>
                  </div>
                  <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{metric.label}</h3>
                  <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                    {metric.value} {metric.subValue && <span className="text-base font-normal text-slate-500">{metric.subValue}</span>}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-primary-dark dark:text-white">{t('dashboard.manager_performance')}</h2>
                  <button className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 transition-colors">
                    {t('dashboard.view_full_report')} <span className="material-icons text-sm">arrow_forward</span>
                  </button>
                </div>
                <div className="overflow-x-auto flex-1">
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
                      {managers.map((m) => (
                        <tr key={m.manager_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{m.manager_name?.[0]}</div>
                              <span className="font-medium text-slate-700 dark:text-slate-200">{m.manager_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block py-1 px-2 bg-slate-100 dark:bg-slate-700 rounded text-sm font-semibold text-slate-600 dark:text-slate-300">{m.total_calls}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-8">{(m.avg_quality || 0).toFixed(1)}</span>
                              <div className="flex-1 h-1.5 w-16 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.avg_quality}%` }}></div>
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
            </div>
          </div>
          )}
        </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
