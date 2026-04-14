import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Team } from '../types';
import { cn } from '../../../shared/utils/cn';

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
        "bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all group relative overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
         <span className="material-icons text-6xl">groups</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
          <span className="material-icons">groups</span>
        </div>
      </div>
      <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{team.name}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 font-medium leading-relaxed">
        {team.description || t('teams.no_desc')}
      </p>
      <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
        <span className={cn(
            "text-[10px] px-2 py-1 rounded font-black uppercase tracking-wider",
            team.auto_assign ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-500"
        )}>
          {team.auto_assign ? t('teams.auto_assign_on') : t('teams.auto_assign_off')}
        </span>
        <div className="flex items-center gap-1 text-primary font-bold text-xs">
            <span>{t('common.view')}</span>
            <span className="material-icons text-sm">arrow_forward</span>
        </div>
      </div>
    </Link>
  );
};

export default TeamCard;
