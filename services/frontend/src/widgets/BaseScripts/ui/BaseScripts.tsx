import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBaseScripts } from '../../../entities/script/model/hooks';
import Button from '../../../shared/ui/Button';
import { Medal } from '../../../shared/ui/Medal';

export const BaseScripts: React.FC = () => {
  const { t } = useTranslation();
  const { baseScripts, currentBase, loading, activateAsBase } = useBaseScripts();

  if (loading && baseScripts.length === 0) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-100 dark:bg-slate-800 rounded"></div>
        <div className="h-24 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl"></div>
        <div className="h-12 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-icons text-primary text-xl">verified</span>
          {t('scripts.base_scripts')}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {t('scripts.base_scripts_desc', 'Select a reference script for cross-team analysis.')}
        </p>
      </div>

      {currentBase && (
        <div className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent dark:from-primary/20 pointer-events-none"></div>
          <div className="relative flex items-center p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 dark:border-primary/30 transition-all">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm mr-4 border border-primary/20">
              <Medal rank={1} className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{t('scripts.active_base')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">{currentBase.name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
          {t('scripts.available_bases', 'Available for Activation')}
        </h4>
        <div className="grid gap-2">
          {baseScripts.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
              <p className="text-sm text-slate-400">{t('scripts.no_base_scripts', 'No base scripts available.')}</p>
            </div>
          ) : (
            baseScripts.map(script => (
              <div
                key={script.id}
                className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                  currentBase?.id === script.id
                    ? 'bg-white dark:bg-slate-800 border-primary shadow-sm'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`material-icons text-lg ${currentBase?.id === script.id ? 'text-primary' : 'text-slate-400'}`}>
                    {currentBase?.id === script.id ? 'check_circle' : 'description'}
                  </span>
                  <span className={`text-sm font-medium truncate ${currentBase?.id === script.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {script.name}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={currentBase?.id === script.id ? 'secondary' : 'ghost'}
                  onClick={() => activateAsBase(script.id)}
                  disabled={currentBase?.id === script.id || loading}
                  className="h-8 text-xs px-3"
                >
                  {currentBase?.id === script.id ? t('scripts.active') : t('scripts.activate')}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
