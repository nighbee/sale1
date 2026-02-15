import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { callApi } from '../api/client';
import Skeleton from '../components/Skeleton';
import { Link } from 'react-router-dom';

const CallsList: React.FC = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, failed: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await callApi.listCalls({});
        setCalls(res.data.calls || []);
        // Simulated stats calculation
        const total = res.data.total || res.data.calls.length;
        const avg = res.data.calls.length > 0 ? 78.4 : 0; // Mocked avg
        setStats({ total, avgScore: avg, failed: 12 });
      } catch (err) {
        console.error('Failed to fetch calls');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organization Calls</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor call quality, processing status, and team performance.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600"><span className="material-icons">call</span></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Total Calls</p><p className="text-lg font-bold">{stats.total}</p></div>
            </div>
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600"><span className="material-icons">analytics</span></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Avg Score</p><p className="text-lg font-bold">{stats.avgScore}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
          <div className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center">
            <div className="relative w-full lg:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><span className="material-icons">search</span></span>
              <input className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm" placeholder="Search calls..." type="text"/>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Call ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Representative</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
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
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        92
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm">
                        <div className={`h-2 w-2 rounded-full mr-2 ${call.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        {call.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <Link to={`/calls/${call.id}`} className="text-primary hover:text-primary-hover font-medium text-sm">View</Link>
                    </td>
                  </tr>
                )))}
                {!loading && calls.length === 0 && <tr><td colSpan={6} className="text-center p-8">No calls found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CallsList;
