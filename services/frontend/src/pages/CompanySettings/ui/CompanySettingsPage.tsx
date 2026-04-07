import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageLayout } from '../../../widgets/PageLayout';
import { integrationApi } from '../../../entities/integration/api';
import type { Integration } from '../../../entities/integration/types';
import { useCompany, useBilling } from '../../../entities/company/model/hooks';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { BillingInfo } from '../../../widgets/BillingInfo/ui/BillingInfo';

const CompanySettingsPage: React.FC = () => {
  const { t } = useTranslation();
  type TabId = 'general' | 'ai' | 'integrations' | 'billing';
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const companyId = localStorage.getItem('company_id') || '';
  const { company, loading: companyLoading, updateSettings, setCompany } = useCompany(companyId) as any;
  const { billing, loading: billingLoading, updateBilling, setBilling } = useBilling(companyId) as any;

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const res = await integrationApi.list();
        setIntegrations(res.data.integrations || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIntegrationsLoading(false);
      }
    };
    fetchIntegrations();
  }, []);

  const handleSaveAll = async () => {
    if (!company) return;
    setSaving(true);
    try {
        const promises = [updateSettings(company)];
        if (billing) {
            promises.push(updateBilling(billing));
        }
        await Promise.all(promises);
        toast.success(t('settings.update_success'));
    } catch {
        toast.error(t('settings.update_failed'));
    } finally {
        setSaving(false);
    }
  };

  const loading = companyLoading || billingLoading || integrationsLoading;

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
                { id: 'ai', label: t('settings.ai_providers') },
                { id: 'integrations', label: t('settings.integrations') },
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
                <section className="space-y-6">
                    <Input
                        label="Company Name"
                        value={company.name}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                        <textarea
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                            rows={4}
                            value={company.description || ''}
                            onChange={(e) => setCompany({ ...company, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Industry"
                            value={company.industry}
                            onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                        />
                        <Input
                            label="Company Size"
                            value={company.size}
                            onChange={(e) => setCompany({ ...company, size: e.target.value })}
                        />
                        <Input
                            label={t('settings.managers_count')}
                            type="number"
                            value={company.managers_count}
                            onChange={(e) => setCompany({ ...company, managers_count: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </section>
            )}

            {activeTab === 'ai' && (
                <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.stt_title')}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.stt_subtitle')}</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { id: 'whisperx_local', name: t('settings.stt_whisperx'), type: 'Free', details: [t('settings.zero_data_egress'), t('settings.lowest_latency')], warning: [t('settings.requires_gpu'), t('settings.higher_maintenance')] },
                  { id: 'openai', name: t('settings.stt_openai'), type: '$0.006 / min', details: [t('settings.highest_accuracy'), t('settings.managed_infra')], warning: [t('settings.data_leaves_region')] },
                  { id: 'gemini', name: t('settings.stt_gemini'), type: '$0.004 / min', details: [t('settings.strong_multilingual'), t('settings.native_gcp')], warning: [t('settings.lower_jargon_accuracy')] },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setCompany({ ...company, stt_model_preference: p.id })}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${company.stt_model_preference === p.id ? 'border-2 border-primary bg-blue-50/20 dark:bg-blue-900/10' : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'}`}
                  >
                    <div className="flex h-5 items-center">
                      <input type="radio" checked={company.stt_model_preference === p.id} readOnly className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-3 flex flex-col w-full">
                      <div className="flex justify-between items-start w-full">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">{p.type}</span>
                      </div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-4 text-xs">
                        <ul className="list-disc pl-4 space-y-1 text-emerald-600 dark:text-emerald-400">
                          {p.details.map(d => <li key={d}>{d}</li>)}
                        </ul>
                        <ul className="list-disc pl-4 space-y-1 text-amber-600 dark:text-amber-500">
                          {p.warning.map(w => <li key={w}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                    {company.stt_model_preference === p.id && <div className="absolute top-4 right-4 text-primary"><span className="material-icons">check_circle</span></div>}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.llm_title')}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.llm_subtitle')}</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { id: 'openai', name: t('settings.llm_openai'), type: '$10 / 1M tokens', details: [t('settings.sota_reasoning'), t('settings.excellent_nuance')], warning: [t('settings.highest_cost'), t('settings.latency_3s')] },
                  { id: 'gemini', name: t('settings.llm_gemini'), type: '$7 / 1M tokens', details: [t('settings.context_window_1m'), t('settings.cost_effective')], warning: [t('settings.strict_safety_filters')] },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setCompany({ ...company, llm_provider: p.id })}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${company.llm_provider === p.id ? 'border-2 border-primary bg-blue-50/20 dark:bg-blue-900/10' : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'}`}
                  >
                    <div className="flex h-5 items-center">
                      <input type="radio" checked={company.llm_provider === p.id} readOnly className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-3 flex flex-col w-full">
                      <div className="flex justify-between items-start w-full">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">{p.type}</span>
                      </div>
                    </div>
                    {company.llm_provider === p.id && <div className="absolute top-4 right-4 text-primary"><span className="material-icons">check_circle</span></div>}
                  </div>
                ))}
              </div>
            </section>
                </>
            )}

            {activeTab === 'integrations' && (
                <section className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { id: 'slack', name: 'Slack', icon: 'chat', desc: 'Sync activities to Slack channels' },
                            { id: 'amocrm', name: 'AmoCRM', icon: 'hub', desc: 'Sync leads and calls with AmoCRM' },
                            { id: 'telegram', name: 'Telegram', icon: 'send', desc: 'Get notifications via Telegram bot' },
                        ].map(int => {
                            const isConnected = integrations.some((i: Integration) => i.integration_type === int.id && i.is_active);
                            return (
                                <div key={int.id} className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-primary">
                                            <span className="material-icons">{int.icon}</span>
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {isConnected ? 'Connected' : 'Disconnected'}
                                        </span>
                                    </div>
                                    <h3 className="font-bold">{int.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1 mb-4">{int.desc}</p>
                                    <Button variant="outline" className="w-full text-xs">Configure</Button>
                                </div>
                            )
                        })}
                    </div>
                </section>
            )}

            {activeTab === 'billing' && billing && (
                <section className="space-y-8">
                    <BillingInfo companyId={companyId} />
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
                             <p className="text-xs text-slate-400 mt-2">Renews on March 15, 2024</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 dark:text-white">Update Payment Method</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Card Holder Name" value={billing.card_holder_name || ''} onChange={(e) => setBilling({...billing, card_holder_name: e.target.value})} />
                            <Input label="Card Number" value={billing.card_number_masked || ''} onChange={(e) => setBilling({...billing, card_number_masked: e.target.value})} />
                            <Input label="Expiration Date (MM/YY)" value={billing.expiration_date || ''} onChange={(e) => setBilling({...billing, expiration_date: e.target.value})} />
                            <Input label="Card Type (Visa/Mastercard)" value={billing.card_type || ''} onChange={(e) => setBilling({...billing, card_type: e.target.value})} />
                        </div>
                    </div>
                </section>
            )}
          </div>

          <div className="lg:col-span-4 sticky top-24">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm overflow-hidden p-6">
              <Button
                isLoading={saving}
                className="w-full py-4 text-base font-bold shadow-xl shadow-primary/30"
                onClick={handleSaveAll}
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
