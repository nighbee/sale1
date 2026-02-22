import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ManagerPerformance } from '../types';
import { ExpandableManagerRow } from './ExpandableManagerRow';

interface ManagerPerformanceListProps {
  managers: ManagerPerformance[];
  loading: boolean;
}

export const ManagerPerformanceList: React.FC<ManagerPerformanceListProps> = ({ managers, loading }) => {
  const { t } = useTranslation();
  const [expandedManagerIds, setExpandedManagerIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (managerId: string) => {
    const newExpanded = new Set(expandedManagerIds);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagerIds(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.manager_performance')}
          </h2>
        </div>
        <div className="space-y-4 p-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (managers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.manager_performance')}
          </h2>
        </div>
        <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
          <span className="material-icons text-5xl block mb-3 opacity-50">person_off</span>
          <p>{t('dashboard.no_managers')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('dashboard.manager_performance')}
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {managers.length} {t('dashboard.managers')}
        </span>
      </div>
      
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {managers.map(manager => (
          <ExpandableManagerRow
            key={manager.manager_id}
            manager={manager}
            isExpanded={expandedManagerIds.has(manager.manager_id)}
            onToggle={() => toggleExpanded(manager.manager_id)}
          />
        ))}
      </div>
    </div>
  );
};
