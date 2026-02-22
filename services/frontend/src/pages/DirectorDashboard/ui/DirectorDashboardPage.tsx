import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsApi } from '../../../entities/analytics/api';
import { PageLayout } from '../../../widgets/PageLayout';
import { ManagerPerformanceList } from '../../../widgets/ManagerPerformanceList';
import type { ManagerPerformance } from '../../../widgets/ManagerPerformanceList';
import Skeleton from '../../../shared/ui/Skeleton';
import { useUserStore } from '../../../entities/user/model/store';
import { SheetCalls } from '../../../widgets/SheetCalls';

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
        const res = await analyticsApi.getTeamPerformance({ 
          period: 'last_30_days', 
          team_id: currentTeamId,
          include_pending: true
        });
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

          {/* ── Manager performance expandable list ────────────────────────── */}
          <ManagerPerformanceList managers={managers} loading={perfLoading} />

          <SheetCalls />

        </div>
      </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
