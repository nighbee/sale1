import React, { useState, useEffect } from 'react';
import { Sidebar } from './DirectorDashboard';
import { callApi } from '../api/client';

const RepDashboard: React.FC = () => {
  const [stats] = useState({
    calls: 42,
    score: 87.5,
    rank: 3,
    totalReps: 8,
    improvement: 2.3
  });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (loading && recentCalls.length === 0) {
    // Initial loading
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real app, we'd fetch rep-specific stats
        const callsRes = await callApi.listCalls({ limit: 5 });
        setRecentCalls(callsRes.data.calls || []);
      } catch (err) {
        console.error('Failed to fetch rep data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 flex h-screen overflow-hidden">
      <Sidebar active="dashboard" />
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border-light dark:border-slate-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-sm" placeholder="Search analytics or calls..." type="text"/>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="h-8 w-px bg-border-light dark:bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Alex Morgan</p>
                <p className="text-xs text-slate-500">Sales Representative</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/20 bg-cover bg-center border border-primary/10" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDYxbtApsI07U94vF85V8AhKd1IYE2tjpVAKbgqEq-hxjro7mIsRCS1rvsD6N62I--sqA5D9j2Ytfl31vDaER65hpue9ODz-BG3_zL8qnPXCn9NYVq1mqA6GpffcL_mjf8HxeWCx-GyhkfBFV5vAgUyiBmVIhyWuyKFS8Hvql-dvyFEK-b6fp8cHVQZ__ZMJrCPOCd29cHWbVt0QrS61a2bFmGaMBPlVzNuV3QVHFvtkTJC3fTWLOuN68PgZnexOBj_jIRWWHLJb8M')"}}></div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">Your Calls</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">{stats.calls}</h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>+5%
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">Your Score</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">{stats.score}</h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>+1.2%
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">Team Rank</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold">#{stats.rank}<span className="text-slate-400 text-lg font-medium">/{stats.totalReps}</span></h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">expand_less</span>1
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-slate-500 mb-1">Improvement</p>
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
              <h2 className="text-xl font-bold">AI Coach Insights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 border-b md:border-b-0 md:border-r border-border-light dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg text-emerald-600">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Great Improvements</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                    <span>Discovery questions are up <strong>15%</strong> this week. Excellent job identifying prospect pain points earlier in the conversation.</span>
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-emerald-500 shrink-0">check_circle</span>
                    <span>Closing velocity has increased by 10% since using the new value-based pitch deck.</span>
                  </li>
                </ul>
              </div>
              <div className="p-8 bg-amber-50/30 dark:bg-amber-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-lg text-amber-600">
                    <span className="material-symbols-outlined">target</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Focus Areas</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-amber-500 shrink-0">lightbulb</span>
                    <span>Try using more <strong>open-ended questions</strong> during the objection handling phase to understand deeper concerns.</span>
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-amber-500 shrink-0">lightbulb</span>
                    <span>Reduce your talk-to-listen ratio in enterprise calls. Target is 45% talk / 55% listen.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Calls</h2>
              <button className="text-primary text-sm font-bold hover:underline">View All Calls</button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Client Name</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">AI Score</th>
                      <th className="px-6 py-4">AI Insight</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-slate-800">
                    {recentCalls.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-sm">corporate_fare</span>
                            </div>
                            <span className="font-semibold">{call.client_phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(call.call_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                            92
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          Strong objection handling and clear next steps defined.
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary font-bold text-sm hover:text-primary/80" onClick={() => window.location.href=`/calls/${call.id}`}>Analyze</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RepDashboard;
