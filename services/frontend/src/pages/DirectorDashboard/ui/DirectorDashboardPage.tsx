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

  const kpis = [
    {
      label: t('dashboard.total_calls'),
      value: totalCalls,
      icon: 'phone_in_talk',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      accent: 'bg-blue-500'
    },
    {
      label: t('dashboard.avg_quality'),
      value: avgQuality,
      icon: 'analytics',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      accent: 'bg-emerald-500'
    },
    {
      label: t('dashboard.active_teams'),
      value: managers.length,
      sub: t('dashboard.managers'),
      icon: 'groups',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-600 dark:text-indigo-400',
      accent: 'bg-indigo-500'
    },
    {
      label: t('nav.integrations'),
      value: 'Live',
      sub: 'Google Sheets',
      icon: 'table_chart',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      accent: 'bg-amber-500'
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout title={t('dashboard.title')}>
      <div className="p-6 md:p-10 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-10">

          {/* ── KPI cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {perfLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <Skeleton className="h-12 w-12 rounded-2xl mb-6" />
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
              ))
            ) : (
              kpis.map(m => (
                <div key={m.label} className="group bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300 relative overflow-hidden">
                  <div className={`absolute -right-4 -top-4 w-24 h-24 ${m.accent} opacity-[0.03] rounded-full group-hover:scale-150 transition-transform duration-500`} />

                  <div className="mb-6">
                    <div className={`p-3 ${m.bg} rounded-2xl ${m.text} inline-block group-hover:scale-110 transition-transform duration-300`}>
                      <span className="material-icons text-2xl">{m.icon}</span>
                    </div>
                  </div>

                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{m.label}</h3>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                      {m.value}
                    </p>
                    {m.sub && <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{m.sub}</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Manager performance expandable list ────────────────────────── */}
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{t('dashboard.manager_performance')}</h2>
             </div>
             <ManagerPerformanceList managers={managers} loading={perfLoading} />
          </div>

          {/* ── Sheet Calls section ────────────────────────── */}
          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-3 px-2">
                <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Recent Calls & Analytics</h2>
             </div>
             <SheetCalls />
          </div>

        </div>
      </div>
    </PageLayout>
  );
};

export default DirectorDashboardPage;
