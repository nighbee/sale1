import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
import { teamApi } from '../../../entities/team/api';
import { userApi } from '../../../entities/user/api';
import type { Team } from '../../../entities/team/types';
import type { User } from '../../../entities/user/types';
import Button from '../../../shared/ui/Button';
import TeamModal from '../../../features/team-management/ui/TeamModal';

const TeamDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [teamRes, usersRes] = await Promise.all([
          teamApi.get(id),
          userApi.listUsers(),
        ]);
        setTeam(teamRes.data);
        const userData = usersRes.data;
        setUsers(userData.users.filter((u) => u.team_id === id));
      } catch {
        console.error('Failed to fetch team details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSuccess = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const teamRes = await teamApi.get(id);
      setTeam(teamRes.data);
    } catch {
      console.error('Failed to fetch team details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm(t('teams.delete_confirm'))) return;
    try {
      await teamApi.delete(id);
      navigate('/teams');
    } catch {
      console.error('Failed to delete team');
    }
  };

  if (loading) return (
    <PageLayout title={t('teams.management_title')}>
        <div className="p-8">{t('common.loading')}</div>
    </PageLayout>
  );
  if (!team) return (
    <PageLayout title={t('teams.management_title')}>
        <div className="p-8">{t('teams.not_found')}</div>
    </PageLayout>
  );

  return (
    <PageLayout title={team.name}>
      <div className="p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <p className="text-slate-500 mt-2 max-w-xl">{team.description}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <Button variant="secondary" onClick={handleDelete} className="text-red-700 hover:bg-red-200">{t('teams.delete_team')}</Button>
             <Button onClick={() => setIsEditModalOpen(true)}>{t('teams.edit_details')}</Button>
          </div>
        </div>

        <TeamModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          teamId={id}
          onSuccess={handleSuccess}
        />

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold">{t('teams.team_members')}</h2>
            <button className="text-primary font-bold text-sm hover:underline" onClick={() => navigate('/invite-members')}>{t('teams.invite_member')}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">{t('common.name')}</th>
                  <th className="px-6 py-4">{t('common.email')}</th>
                  <th className="px-6 py-4">{t('common.role')}</th>
                  <th className="px-6 py-4 text-right">{t('common.actions')}</th>
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
                {users.length === 0 && <tr><td colSpan={4} className="text-center p-8 text-slate-500">{t('teams.no_members')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default TeamDetailPage;
