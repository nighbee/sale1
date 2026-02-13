import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../api/client';

const Sidebar: React.FC<{ active: string }> = ({ active }) => {
  return (
    <aside className="w-64 bg-primary-dark dark:bg-slate-900 flex-shrink-0 flex flex-col text-white transition-all duration-300">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="material-icons text-lg">insights</span>
          </div>
          <span className="font-bold text-lg tracking-tight">SalesAI</span>
        </div>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {[
          { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
          { id: 'teams', icon: 'groups', label: 'Teams', path: '/teams' },
          { id: 'calls', icon: 'call', label: 'Calls', path: '/calls' },
          { id: 'leaderboard', icon: 'leaderboard', label: 'Leaderboard', path: '/leaderboard' },
          { id: 'integrations', icon: 'hub', label: 'Integrations', path: '/integrations' },
          { id: 'settings', icon: 'settings', label: 'Settings', path: '/settings' },
        ].map((item) => (
          <a
            key={item.id}
            href={item.path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-colors ${
              active === item.id ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="material-icons text-xl group-hover:text-primary-300">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <button className="flex items-center gap-3 w-full hover:bg-white/5 p-2 rounded-lg transition-colors text-left">
          <img
            alt="Profile"
            className="w-9 h-9 rounded-full border-2 border-primary"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-E_TDTpvwgUsWY03c8YNZVfIkJPM7_vYomCxVaURoVI3SsPy63e3EU_lUsxp5L9tDvJx2QEkplHwv6cyBGxSG9PnNqRP9PAMG_13ze__58mxV5LhcQcYqExwVDaFZc33iosJb59WR0PVvspn1B5ju13RY0hEhmNnB11BZE2Pm5r-j3KEi6LBSVv6HP-0WxkaUUbbneR-3537h5WGN2JGsuc8EpbnwzV1FRkXQW4PnoiPH2scNBczW6VnVHnerJBrPnvl5e2vVZRM"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Alex Morgan</p>
            <p className="text-xs text-slate-400 truncate">Director of Sales</p>
          </div>
          <span className="material-icons text-slate-400 text-lg">more_vert</span>
        </button>
      </div>
    </aside>
  );
};

const DirectorDashboard: React.FC = () => {
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await analyticsApi.getTeamPerformance('last_30_days');
        setManagers(response.data.managers || []);
      } catch (err) {
        console.error('Failed to fetch performance data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalCalls = managers.reduce((acc, m) => acc + (m.total_calls || 0), 0);
  const avgQuality = managers.length > 0
    ? (managers.reduce((acc, m) => acc + (m.avg_quality || 0), 0) / managers.length).toFixed(1)
    : '0.0';

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-200 h-screen flex overflow-hidden w-full">
      <Sidebar active="dashboard" />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-8 flex-shrink-0 z-10">
          <h1 className="text-xl font-semibold text-primary-dark dark:text-white">Overall Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <span className="material-icons text-lg">search</span>
              </span>
              <input className="pl-10 pr-4 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary w-64 transition-all" placeholder="Search teams, calls..." type="text"/>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
              <span className="material-icons text-lg text-slate-400">calendar_today</span>
              Last 30 Days
              <span className="material-icons text-lg text-slate-400">expand_more</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Calls', value: totalCalls, trend: '+12%', icon: 'phone_in_talk', color: 'blue' },
                { label: 'Avg Quality', value: avgQuality, trend: '+2.1', icon: 'analytics', color: 'purple' },
                { label: 'Active Teams', value: managers.length, subValue: 'Managers', icon: 'groups', color: 'indigo' },
                { label: 'Pending Analysis', value: '3', subValue: 'Pending', icon: 'hourglass_top', color: 'orange', status: 'Processing' },
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
                  <h2 className="text-lg font-bold text-primary-dark dark:text-white">Manager Performance</h2>
                  <button className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 transition-colors">
                    View Full Report <span className="material-icons text-sm">arrow_forward</span>
                  </button>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-4 font-semibold">Manager</th>
                        <th className="px-6 py-4 text-center">Calls</th>
                        <th className="px-6 py-4">Quality</th>
                        <th className="px-6 py-4">Script Match</th>
                        <th className="px-6 py-4 text-right">KPI</th>
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
      </main>
    </div>
  );
};

export default DirectorDashboard;
export { Sidebar };
