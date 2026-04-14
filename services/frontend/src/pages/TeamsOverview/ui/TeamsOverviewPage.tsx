import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
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

  return (
    <PageLayout title={t('teams.management_title')}>
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('teams.management_title')}</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">{t('teams.management_subtitle')}</p>
          </div>
          <Button onClick={handleCreateClick} className="w-full sm:w-auto shadow-lg shadow-primary/20 font-bold px-6">
            <span className="material-icons text-sm mr-2">add</span>
            {t('teams.create_team')}
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
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
      </div>
    </PageLayout>
  );
};

export default TeamsOverviewPage;
