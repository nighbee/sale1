import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../widgets/Sidebar';
import { analyticsApi } from '../../../entities/analytics/api';

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await analyticsApi.getLeaderboard();
        const responseData = res.data as any;
        setData(responseData.leaderboard || []);
      } catch {
        console.error('Failed to fetch leaderboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const topThree = data.slice(0, 3);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 min-h-screen font-display antialiased transition-colors duration-200 flex">
      <Sidebar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('leaderboard.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('leaderboard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2 px-4 rounded-lg text-sm">
              <option>{t('leaderboard.all_teams')}</option>
            </select>
            <button className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm">
              <span className="material-icons text-sm">download</span> {t('leaderboard.export')}
            </button>
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
      </main>
    </div>
  );
};

export default LeaderboardPage;
