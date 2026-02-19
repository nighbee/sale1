import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '../types';
import { cn } from '../../../shared/utils/cn';

interface TeamCardProps {
  team: Team;
  className?: string;
  onEdit?: (id: string) => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, className, onEdit }) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative cursor-pointer",
        className
      )}
    >
      <Link to={`/teams/${team.id}`} className="absolute inset-0 z-0" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <span className="material-icons">groups</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.(team.id);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-icons text-sm">edit</span>
          </button>
        </div>
        <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{team.name}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
          {team.description || t('teams.no_desc')}
        </p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            {team.auto_assign ? t('teams.auto_assign_on') : t('teams.auto_assign_off')}
          </span>
          <span className="material-icons text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            arrow_forward
          </span>
        </div>
      </div>
    </div>
  );
};

export default TeamCard;
