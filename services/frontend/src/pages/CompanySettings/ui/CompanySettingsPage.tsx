import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageLayout } from '../../../widgets/PageLayout';
import { useCompany } from '../../../entities/company/model/hooks';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Textarea from '../../../shared/ui/Textarea';

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  managers_count: z.preprocess((val) => Number(val), z.number().min(0)),
  stt_model_preference: z.string().optional(),
  llm_provider: z.string().optional(),
});


type CompanyFormValues = z.infer<typeof companySchema>;

const CompanySettingsPage: React.FC = () => {
  const { t } = useTranslation();
  type TabId = 'general';
  const [activeTab] = useState<TabId>('general');

  const { company, loading: companyLoading, updateSettings } = useCompany() as any;

  const {
    register,
    handleSubmit,
    reset: resetCompany,
    formState: { errors: companyErrors, isSubmitting: isSavingCompany },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema) as any,
  });

  useEffect(() => {
    if (company) {
      resetCompany({
        name: company.name || '',
        description: company.description || '',
        industry: company.industry || '',
        size: company.size || '',
        managers_count: company.managers_count || 0,
        stt_model_preference: company.stt_model_preference || 'whisperx_local',
        llm_provider: company.llm_provider || 'openai',
      });
    }
  }, [company, resetCompany]);

  const onSaveCompany: SubmitHandler<CompanyFormValues> = async (data) => {
    try {
      await updateSettings(data);
      toast.success(t('settings.update_success'));
    } catch {
      toast.error(t('settings.update_failed'));
    }
  };

  const loading = companyLoading;

  if (loading) return (
    <PageLayout title={t('settings.title')}>
        <div className="p-8">{t('settings.loading')}</div>
    </PageLayout>
  );
  if (!company) return (
    <PageLayout title={t('settings.title')}>
        <div className="p-8">{t('settings.not_found')}</div>
    </PageLayout>
  );

  return (
    <PageLayout title={t('settings.title')}>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('settings.subtitle')}</p>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-10">
            {activeTab === 'general' && (
                <form id="company-form" onSubmit={handleSubmit(onSaveCompany)} className="space-y-6">
                    <Input
                        label="Company Name"
                        {...register('name')}
                        error={companyErrors.name?.message}
                    />
                    <Textarea
                        label="Description"
                        rows={4}
                        {...register('description')}
                        error={companyErrors.description?.message}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Industry"
                            {...register('industry')}
                            error={companyErrors.industry?.message}
                        />
                        <Input
                            label="Company Size"
                            {...register('size')}
                            error={companyErrors.size?.message}
                        />
                        <Input
                            label={t('settings.managers_count')}
                            type="number"
                            {...register('managers_count')}
                            error={companyErrors.managers_count?.message}
                        />
                    </div>
                </form>
            )}


          </div>

          <div className="lg:col-span-4 sticky top-24">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm overflow-hidden p-6">
              <Button
                isLoading={isSavingCompany}
                className="w-full py-4 text-base font-bold shadow-xl shadow-primary/30"
                type="button"
                onClick={() => {
                  if (activeTab === 'general') {
                    handleSubmit(onSaveCompany)();
                  }
                }}
              >
                {t('settings.save_changes')}
              </Button>
              <p className="text-center text-xs text-slate-400 mt-4">All changes will be applied instantly to your organization.</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default CompanySettingsPage;
