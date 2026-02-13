import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from './DirectorDashboard';
import { teamApi, userApi } from '../api/client';

const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [teamRes, usersRes] = await Promise.all([
          teamApi.get(id),
          userApi.listUsers(),
        ]);
        setTeam(teamRes.data);
        setUsers(usersRes.data.users.filter((u: any) => u.team_id === id));
      } catch (err) {
        console.error('Failed to fetch team details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this team?')) return;
    try {
      await teamApi.delete(id);
      navigate('/teams');
    } catch (err) {
      console.error('Failed to delete team');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!team) return <div className="p-8">Team not found.</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <Sidebar active="teams" />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <p className="text-slate-500 mt-2 max-w-xl">{team.description}</p>
          </div>
          <div className="flex gap-3">
             <button onClick={handleDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors">Delete Team</button>
             <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold">Edit Details</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold">Team Members</h2>
            <button className="text-primary font-bold text-sm hover:underline" onClick={() => navigate('/invite-members')}>+ Invite Member</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-medium">{user.full_name}</td>
                    <td className="px-6 py-4 text-slate-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">{user.role}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-slate-600"><span className="material-icons">more_horiz</span></button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={4} className="text-center p-8 text-slate-500">No members in this team.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeamDetail;
