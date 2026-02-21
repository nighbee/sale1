import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Period, Source, SortKey } from "@entities/analytics";

interface LeaderboardFiltersProps {
  period: Period;
  source: Source;
  sortBy: SortKey;
  onPeriodChange: (p: Period) => void;
  onSourceChange: (s: Source) => void;
  onSortChange: (s: SortKey) => void;
}

export const LeaderboardFilters: React.FC<LeaderboardFiltersProps> = ({
  period,
  source,
  sortBy,
  onPeriodChange,
  onSourceChange,
  onSortChange,
}) => {
  const { t } = useTranslation();

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: '', label: 'All' },
  ];

  const SOURCE_OPTIONS: { key: Source; label: string; icon: string }[] = [
    { key: '', label: 'All', icon: 'merge' },
    { key: 'google_sheets', label: 'Sheets', icon: 'table_chart' },
    { key: 'sipuni', label: 'Sipuni', icon: 'call' },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'avg_kpi', label: 'KPI' },
    { key: 'avg_quality', label: 'Quality' },
    { key: 'avg_script_match', label: 'Script' },
    { key: 'avg_errors_free', label: 'Errors' },
    { key: 'total_calls', label: 'Calls' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">{t('leaderboard.period')}</span>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPeriodChange(opt.key)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                period === opt.key
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">{t('leaderboard.source')}</span>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSourceChange(opt.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                source === opt.key
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <span className="material-icons text-sm">{opt.icon}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:ml-auto">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">{t('leaderboard.sort_by')}</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="bg-slate-100 dark:bg-slate-800 border-none text-xs font-bold rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 transition-all text-slate-700 dark:text-slate-300"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
