import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from "@entities/team";
import { cn } from "@shared/utils/cn";

interface TeamCardProps {
  team: Team;
  className?: string;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, className }) => {
  const { t } = useTranslation();
  return (
    <Link
      to={`/teams/${team.id}`}
      className={cn(
        "bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          <span className="material-icons">groups</span>
        </div>
        <span className="text-xs font-bold text-slate-400">ID: {team.id.slice(0, 8)}</span>
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
    </Link>
  );
};

export default TeamCard;
