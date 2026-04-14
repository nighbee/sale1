import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { analyticsApi } from '../../../entities/analytics/api';
import { PageLayout } from '../../../widgets/PageLayout';
import { ManagerPerformanceList } from '../../../widgets/ManagerPerformanceList';
import type { ManagerPerformance } from '../../../widgets/ManagerPerformanceList';
import Skeleton from '../../../shared/ui/Skeleton';
import { useUserStore } from '../../../entities/user/model/store';

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
        // Only include team_id if it's not null/undefined
        const params: Record<string, unknown> = { 
          period: '30d', 
          include_pending: true
        };
        if (currentTeamId) {
          params.team_id = currentTeamId;
        }
        
        const res = await analyticsApi.getTeamPerformance(params);
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
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Header Section ────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
             <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('dashboard.title')}</h2>
                <p className="text-sm text-slate-500 font-medium">Performance metrics for the last 30 days</p>
             </div>
             <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Active Session
                </span>
             </div>
          </div>

          {/* ── KPI cards ────────────────────────────────────────────────── */}
          {perfLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: t('dashboard.total_calls'), value: totalCalls, icon: 'phone_in_talk', color: 'blue' },
                { label: t('dashboard.avg_quality'),  value: avgQuality,  icon: 'analytics', color: 'emerald' },
                { label: t('dashboard.active_teams'), value: managers.length, sub: t('dashboard.managers'), icon: 'groups', color: 'indigo' },
              ].map(m => (
                <div key={m.label} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{m.label}</h3>
                    <span className={`material-icons text-lg text-${m.color}-500/80`}>{m.icon}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {m.value}
                    </p>
                    {m.sub && <span className="text-[11px] font-semibold text-slate-400 uppercase">{m.sub}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Manager performance expandable list ────────────────────────── */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('dashboard.managers')}</h3>
             </div>
             <ManagerPerformanceList managers={managers} loading={perfLoading} />
          </div>

        </div>
      </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
