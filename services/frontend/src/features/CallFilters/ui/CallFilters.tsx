import React from 'react';
import { useTranslation } from 'react-i18next';
import Select from '../../../shared/ui/Select';
import type { User } from '../../../entities/user/types';

interface CallFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  managerId: string;
  onManagerChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  managers: User[];
  showManagerFilter: boolean;
}

export const CallFilters: React.FC<CallFiltersProps> = ({
  search,
  onSearchChange,
  managerId,
  onManagerChange,
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  managers,
  showManagerFilter,
}) => {
  const { t } = useTranslation();

  const statusOptions = [
    { value: '', label: t('common.all') || 'All Statuses' },
    { value: 'completed', label: t('calls.stats.completed') || 'Success' },
    { value: 'pending', label: t('calls.stats.pending') },
    { value: 'processing', label: t('calls.stats.processing') },
    { value: 'error', label: t('calls.stats.error') },
  ];

  const managerOptions = [
    { value: '', label: t('calls.all_managers') || 'All Managers' },
    ...managers.map((m) => ({
      value: m.manager_id || '',
      label: `${m.first_name || m.username || m.email} ${m.last_name || ''}`.trim(),
    })),
  ];

  return (
    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-end flex-wrap">
      <div className="relative w-full md:w-64">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
          {t('common.search') || 'Search'}
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <span className="material-icons text-sm">search</span>
          </span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            placeholder={t('calls.search')}
            type="text"
          />
        </div>
      </div>

      <div className="w-full md:w-48">
        <Select
          label={t('common.status') || 'Status'}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={statusOptions}
        />
      </div>

      {showManagerFilter && (
        <div className="w-full md:w-64">
          <Select
            label={t('dashboard.manager') || 'Manager'}
            value={managerId}
            onChange={(e) => onManagerChange(e.target.value)}
            options={managerOptions}
          />
        </div>
      )}

      <div className="w-full md:w-40">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
          {t('calls.from_date') || 'From Date'}
        </label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      <div className="w-full md:w-40">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
          {t('calls.to_date') || 'To Date'}
        </label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>
    </div>
  );
};
