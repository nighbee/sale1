import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBaseScripts } from '../../../entities/script/model/hooks';
import Button from '../../../shared/ui/Button';
import { Medal } from '../../../shared/ui/Medal';

export const BaseScripts: React.FC = () => {
  const { t } = useTranslation();
  const { baseScripts, currentBase, loading, activateAsBase } = useBaseScripts();

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">{t('scripts.base_scripts')}</h3>
      {currentBase && (
        <div className="flex items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Medal rank={1} className="w-8 h-8 text-primary mr-3" />
          <div>
            <p className="text-sm text-primary font-semibold">Active Base Script</p>
            <p className="text-lg font-medium">{currentBase.name}</p>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        {baseScripts.map(script => (
          <div key={script.id} className="flex justify-between items-center p-3 bg-white rounded-md border border-slate-200">
            <span>{script.name}</span>
            <Button
              size="sm"
              variant={currentBase?.id === script.id ? 'secondary' : 'outline'}
              onClick={() => activateAsBase(script.id)}
              disabled={currentBase?.id === script.id}
            >
              {currentBase?.id === script.id ? 'Active' : t('scripts.activate')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
