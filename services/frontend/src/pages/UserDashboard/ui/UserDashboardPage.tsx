import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
import { userApi } from '../../../entities/user/api';
import { useUserStore } from '../../../entities/user/model/store';
import Skeleton from '../../../shared/ui/Skeleton';

interface CallRecord {
  id: string;
  customer_phone?: string;
  timestamp: string;
}

export const UserDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [stats] = useState({
    calls: 42,
    score: 87.5,
    rank: 3,
    totalReps: 8,
    improvement: 2.3
  });
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const callsRes = await userApi.getUserCalls(user.id, { limit: 5 });
        const data = callsRes.data as { calls: CallRecord[] };
        setRecentCalls(data.calls || []);
      } catch {
        console.error('Failed to fetch rep data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  return (
    <PageLayout title={t('dashboard.title')}>
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          {user?.manager_name && (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-4">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('dashboard.your_team')}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('dashboard.team_of', { manager: user.manager_name })}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">{t('dashboard.your_calls')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">{stats.calls}</h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>+5%
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">{t('dashboard.your_score')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">{stats.score}</h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>+1.2%
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">{t('dashboard.team_rank')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">#{stats.rank}<span className="text-slate-400 text-lg font-medium">/{stats.totalReps}</span></h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">expand_less</span>1
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">{t('dashboard.improvement')}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">+{stats.improvement}%</h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>0.4%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border-light dark:border-slate-800 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">psychology</span>
              <h2 className="text-xl font-bold">{t('dashboard.ai_coach')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 border-b md:border-b-0 md:border-r border-border-light dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg text-emerald-600">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('dashboard.great_improvements')}</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                    <span dangerouslySetInnerHTML={{ __html: t('dashboard.discovery_insight') }} />
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                    <span dangerouslySetInnerHTML={{ __html: t('dashboard.closing_insight') }} />
                  </li>
                </ul>
              </div>
              <div className="p-8 bg-amber-50/30 dark:bg-amber-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-lg text-amber-600">
                    <span className="material-symbols-outlined">target</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('dashboard.focus_areas')}</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-amber-500 shrink-0">lightbulb</span>
                    <span dangerouslySetInnerHTML={{ __html: t('dashboard.open_ended_insight') }} />
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-amber-500 shrink-0">lightbulb</span>
                    <span dangerouslySetInnerHTML={{ __html: t('dashboard.talk_ratio_insight') }} />
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('dashboard.recent_calls')}</h2>
              <button className="text-primary text-sm font-bold hover:underline" onClick={() => navigate('/calls')}>{t('dashboard.view_all')}</button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">{t('dashboard.client_name')}</th>
                      <th className="px-6 py-4">{t('calls.date')}</th>
                      <th className="px-6 py-4">{t('calls.score')}</th>
                      <th className="px-6 py-4">{t('dashboard.ai_insight')}</th>
                      <th className="px-6 py-4 text-right">{t('dashboard.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-slate-800">
                    {loading ? (
                      [1, 2, 3, 4, 5].map((i) => (
                        <tr key={i}>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                        </tr>
                      ))
                    ) : (
                    (recentCalls as unknown as CallRecord[]).map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-sm">corporate_fare</span>
                            </div>
                            <span className="font-semibold">{call.customer_phone || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{call.timestamp ? new Date(call.timestamp).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                            92
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {t('calls.excellent_insight', 'Strong objection handling and clear next steps defined.')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary font-bold text-sm hover:text-primary/80" onClick={() => navigate(`/calls/${call.id}`)}>{t('dashboard.analyze')}</button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
    </PageLayout>
  );
};
