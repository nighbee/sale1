import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../widgets/Sidebar';
import { teamApi } from '../../../entities/team/api';
import type { Team } from '../../../entities/team/types';
import TeamCard from '../../../entities/team/ui/TeamCard';
import Button from '../../../shared/ui/Button';
import TeamModal from '../../../features/team-management/ui/TeamModal';

const TeamsOverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);

  const fetchTeams = async () => {
    try {
      const res = await teamApi.list();
      setTeams(res.data.teams || []);
    } catch {
      console.error('Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsModalOpen(true);
    }
    fetchTeams();
  }, []);

  const handleCreateClick = () => {
    setSelectedTeamId(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (id: string) => {
    setSelectedTeamId(id);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">{t('teams.management_title')}</h1>
            <p className="text-slate-500">{t('teams.management_subtitle')}</p>
          </div>
          <Button onClick={handleCreateClick}>{t('teams.create_team')}</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} onEdit={handleEditClick} />
            ))}
            {teams.length === 0 && <p className="text-slate-500 col-span-full text-center py-12">{t('teams.no_teams')}</p>}
          </div>
        )}

        <TeamModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          teamId={selectedTeamId}
          onSuccess={fetchTeams}
        />
      </main>
    </div>
  );
};

export default TeamsOverviewPage;
