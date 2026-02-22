import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CallAnalysis as CallAnalysisType } from '../../../entities/call/types';

interface CallAnalysisProps {
  analysis: CallAnalysisType | null;
  className?: string;
}

export const CallAnalysis: React.FC<CallAnalysisProps> = ({ analysis, className = "" }) => {
  const { t } = useTranslation();

  return (
    <div className={`space-y-8 ${className}`}>
      <div>
        <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
          <span className="material-icons text-primary text-lg">analytics</span> {t('calls.analysis')}
        </h2>
        {analysis ? (
          <div className="space-y-4">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{t('calls.quality_score')}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{analysis.quality_score}<span className="text-sm text-neutral-400 font-normal">/100</span></p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100">
                <p className="text-xs text-neutral-500 mb-1">{t('calls.script_match')}</p>
                <span className="text-xl font-bold">{analysis.script_match}%</span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100">
                <p className="text-xs text-neutral-500 mb-1">{t('calls.errors_free')}</p>
                <span className="text-xl font-bold">{analysis.errors_free}%</span>
              </div>
            </div>
            {analysis.brief && (
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-icons text-sm text-slate-500">summarize</span>
                  <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{t('calls.brief')}</h3>
                </div>
                <p className="text-sm leading-relaxed">{analysis.brief}</p>
              </div>
            )}
            {analysis.recommendation && (
              <div className="bg-blue-50 dark:bg-primary/10 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-icons text-sm text-blue-500">tips_and_updates</span>
                  <h3 className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400">{t('calls.recommendation')}</h3>
                </div>
                <p className="text-sm leading-relaxed">{analysis.recommendation}</p>
              </div>
            )}
            {analysis.next_best_action && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-icons text-sm text-emerald-500">rocket_launch</span>
                  <h3 className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">{t('calls.next_best_action')}</h3>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{analysis.next_best_action}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('calls.analysis_pending')}</p>
        )}
      </div>
    </div>
  );
};
