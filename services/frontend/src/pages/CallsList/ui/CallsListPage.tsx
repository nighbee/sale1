import React, { useState, useEffect } from 'react';
import { PageLayout } from '../../../widgets/PageLayout';
import { callApi } from '../../../entities/call/api';
import type { Call } from '../../../entities/call/types';
import Skeleton from '../../../shared/ui/Skeleton';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../../entities/user/model/store';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';
import { useCallback } from 'react';

const CallsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, failed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callApi.listCalls({ team_id: currentTeamId });
      const data = res.data;
      setCalls(data.calls || []);
      // Simulated stats calculation
      const total = data.total || (data.calls ? data.calls.length : 0);
      const avg = data.calls && data.calls.length > 0 ? 78.4 : 0; // Mocked avg
      setStats({ total, avgScore: avg, failed: 12 });
    } catch {
      console.error('Failed to fetch calls');
    } finally {
      setLoading(false);
    }
  }, [currentTeamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useWebSocket(useCallback((msg) => {
    if (msg.type === 'analysis_completed') {
      fetchData();
    }
  }, [fetchData]));

  return (
    <PageLayout title={t('calls.list_title')}>
      <div className="p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('calls.list_title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{t('calls.list_subtitle')}</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600"><span className="material-icons">call</span></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">{t('dashboard.total_calls')}</p><p className="text-lg font-bold">{stats.total}</p></div>
            </div>
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600"><span className="material-icons">analytics</span></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">{t('dashboard.avg_quality')}</p><p className="text-lg font-bold">{stats.avgScore}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
          <div className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center">
            <div className="relative w-full lg:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><span className="material-icons">search</span></span>
              <input className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm" placeholder={t('calls.search')} type="text"/>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('calls.id')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('calls.datetime')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('calls.representative')}</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('calls.score')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('calls.status')}</th>
                  <th className="relative px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-12" /></td>
                    </tr>
                  ))
                ) : (
                calls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/calls/${call.id}`} className="text-sm font-mono text-primary hover:underline">#{call.id.slice(0, 8)}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                       {new Date(call.call_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-sm">
                      {call.manager_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        (call.kpi || 0) > 50 ? 'bg-green-100 text-green-800' :
                        (call.kpi || 0) > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {call.kpi?.toFixed(1) || '0.0'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm">
                        <div className={`h-2 w-2 rounded-full mr-2 ${call.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        {call.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <Link to={`/calls/${call.id}`} className="text-primary hover:text-primary-hover font-medium text-sm">{t('calls.view')}</Link>
                    </td>
                  </tr>
                )))}
                {!loading && calls.length === 0 && <tr><td colSpan={6} className="text-center p-8">{t('calls.no_calls')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default CallsListPage;
