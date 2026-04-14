import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageLayout } from '../../../widgets/PageLayout';
import { useCompany, useBilling } from '../../../entities/company/model/hooks';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import Textarea from '../../../shared/ui/Textarea';
import { BillingInfo } from '../../../widgets/BillingInfo/ui/BillingInfo';

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  managers_count: z.preprocess((val) => Number(val), z.number().min(0)),
  stt_model_preference: z.string(),
  llm_provider: z.string(),
});

const billingSchema = z.object({
  card_holder_name: z.string().optional(),
  card_number_masked: z.string().optional(),
  expiration_date: z.string().optional(),
  card_type: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;
type BillingFormValues = z.infer<typeof billingSchema>;

const CompanySettingsPage: React.FC = () => {
  const { t } = useTranslation();
  type TabId = 'general' | 'billing';
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const { company, loading: companyLoading, updateSettings } = useCompany() as any;
  const { billing, loading: billingLoading, updateBilling } = useBilling() as any;

  const {
    register,
    handleSubmit,
    reset: resetCompany,
    formState: { errors: companyErrors, isSubmitting: isSavingCompany },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema) as any,
  });

  const {
    register: registerBilling,
    handleSubmit: handleSubmitBilling,
    reset: resetBilling,
    formState: { errors: billingErrors, isSubmitting: isSavingBilling },
  } = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema) as any,
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

  useEffect(() => {
    if (billing) {
      resetBilling({
        card_holder_name: billing.card_holder_name || '',
        card_number_masked: billing.card_number_masked || '',
        expiration_date: billing.expiration_date || '',
        card_type: billing.card_type || '',
      });
    }
  }, [billing, resetBilling]);

  const onSaveCompany: SubmitHandler<CompanyFormValues> = async (data) => {
    try {
      await updateSettings(data);
      toast.success(t('settings.update_success'));
    } catch {
      toast.error(t('settings.update_failed'));
    }
  };

  const onSaveBilling: SubmitHandler<BillingFormValues> = async (data) => {
    try {
      await updateBilling(data);
      toast.success(t('settings.update_success'));
    } catch {
      toast.error(t('settings.update_failed'));
    }
  };

  const loading = companyLoading || billingLoading;

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

        <div className="border-b border-border-light dark:border-border-dark mb-8 overflow-x-auto">
          <nav className="-mb-px flex space-x-8">
            {[
                { id: 'general', label: t('settings.general') },
                { id: 'billing', label: t('settings.billing') },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all`}
                >
                    {tab.label}
                </button>
            ))}
          </nav>
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


            {activeTab === 'billing' && billing && (
                <form id="billing-form" onSubmit={handleSubmitBilling(onSaveBilling)} className="space-y-8">
                    <BillingInfo />
                    <div className="bg-gradient-to-br from-primary to-blue-700 p-8 rounded-2xl text-white shadow-xl shadow-primary/20">
                        <div className="flex justify-between items-start mb-12">
                            <span className="text-lg font-bold italic tracking-widest uppercase">{billing.card_type || 'VISA'}</span>
                            <span className="material-icons text-3xl">contactless</span>
                        </div>
                        <div className="mb-8">
                            <p className="text-xs text-white/60 uppercase tracking-widest mb-2 font-medium">Card Number</p>
                            <p className="text-2xl font-mono tracking-[0.2em]">{billing.card_number_masked || '•••• •••• •••• ••••'}</p>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-white/60 uppercase mb-1 font-medium">Card Holder</p>
                                <p className="font-bold tracking-wide uppercase">{billing.card_holder_name || 'NOT PROVIDED'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-white/60 uppercase mb-1 font-medium">Expires</p>
                                <p className="font-bold font-mono">{billing.expiration_date || 'MM/YY'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wider">Token Usage</h3>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-3xl font-black">{billing.tokens_used?.toLocaleString()}</span>
                                <span className="text-slate-400 font-medium">/ {billing.tokens_limit?.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-primary h-full" style={{ width: `${((billing.tokens_used || 0) / (billing.tokens_limit || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                             <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wider">Plan</h3>
                             <div className="flex items-center gap-3">
                                 <span className="text-2xl font-black uppercase">{company.subscription_tier}</span>
                                 <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Active</span>
                             </div>
                             <p className="text-xs text-slate-400 mt-2">{t('settings.renews_on', { date: 'March 15, 2024' })}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 dark:text-white">Update Payment Method</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Card Holder Name" {...registerBilling('card_holder_name')} error={billingErrors.card_holder_name?.message} />
                            <Input label="Card Number" {...registerBilling('card_number_masked')} error={billingErrors.card_number_masked?.message} />
                            <Input label="Expiration Date (MM/YY)" {...registerBilling('expiration_date')} error={billingErrors.expiration_date?.message} />
                            <Input label="Card Type (Visa/Mastercard)" {...registerBilling('card_type')} error={billingErrors.card_type?.message} />
                        </div>
                    </div>
                </form>
            )}
          </div>

          <div className="lg:col-span-4 sticky top-24">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm overflow-hidden p-6">
              <Button
                isLoading={isSavingCompany || isSavingBilling}
                className="w-full py-4 text-base font-bold shadow-xl shadow-primary/30"
                type="button"
                onClick={() => {
                  if (activeTab === 'billing') {
                    handleSubmitBilling(onSaveBilling)();
                  } else if (activeTab === 'general') {
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
