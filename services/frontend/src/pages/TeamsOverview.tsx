import React, { useState, useEffect } from 'react';
import { Sidebar } from './DirectorDashboard';
import { teamApi } from '../api/client';
import { Link } from 'react-router-dom';

const TeamsOverview: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await teamApi.list();
        setTeams(res.data.teams || []);
      } catch (err) {
        console.error('Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <Sidebar active="teams" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Teams Management</h1>
            <p className="text-slate-500">Organize and monitor your sales teams.</p>
          </div>
          <Link to="/team-creation" className="bg-primary text-white px-4 py-2 rounded-lg font-bold">Create Team</Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <span className="material-icons">groups</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">ID: {team.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{team.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{team.description || 'No description provided.'}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {team.auto_assign ? 'Auto-assign ON' : 'Auto-assign OFF'}
                  </span>
                  <span className="material-icons text-primary opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                </div>
              </Link>
            ))}
            {teams.length === 0 && <p className="text-slate-500 col-span-full text-center py-12">No teams created yet.</p>}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeamsOverview;
