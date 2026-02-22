import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ManagerPerformance } from '../types';

interface ExpandableManagerRowProps {
  manager: ManagerPerformance;
  isExpanded: boolean;
  onToggle: () => void;
}

export const ExpandableManagerRow: React.FC<ExpandableManagerRowProps> = ({
  manager,
  isExpanded,
  onToggle,
}) => {
  const { t } = useTranslation();

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-green-600 dark:text-green-400';
    if (quality >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getQualityBgColor = (quality: number) => {
    if (quality >= 80) return 'bg-green-500';
    if (quality >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <>
      <div
        onClick={onToggle}
        className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Expand/Collapse Icon */}
            <div className="w-6 flex justify-center">
              <span
                className={`material-icons text-slate-400 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              >
                chevron_right
              </span>
            </div>

            {/* Manager Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                {manager.manager_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                  {manager.manager_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {manager.total_calls} {t('dashboard.calls')}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-6 ml-auto">
              {/* Quality */}
              <div className="flex flex-col items-end min-w-max">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getQualityColor(manager.avg_quality || 0)}`}>
                    {(manager.avg_quality || 0).toFixed(1)}
                  </span>
                  <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getQualityBgColor(manager.avg_quality || 0)}`}
                      style={{ width: `${Math.min(manager.avg_quality || 0, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('dashboard.quality')}
                </span>
              </div>

              {/* Script Match */}
              <div className="flex flex-col items-end min-w-max">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {(manager.avg_script_match || 0).toFixed(0)}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.script_match')}
                </span>
              </div>

              {/* KPI */}
              <div className="flex flex-col items-end min-w-max">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {(manager.avg_kpi || 0).toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.kpi')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('dashboard.avg_quality')}
                </p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {(manager.avg_quality || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('dashboard.script_match')}
                </p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {(manager.avg_script_match || 0).toFixed(2)}%
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Avg Errors Free
                </p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {(manager.avg_errors_free || 0).toFixed(2)}%
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('dashboard.total_calls')}
                </p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {manager.total_calls}
                </p>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-600 dark:text-slate-400">Completed</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-slate-600 dark:text-slate-400">Processing</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-600 dark:text-slate-400">Pending</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
