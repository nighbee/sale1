import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageLayout } from '../../../widgets/PageLayout';
import { integrationApi } from '../../../entities/integration/api';
import type { Integration } from '../../../entities/integration/types';
import IntegrationModal from '../../../features/integrations/ui/IntegrationModal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';

const IntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const [res, settingsRes] = await Promise.all([
          integrationApi.list(),
          integrationApi.getAISettings()
      ]);
      setIntegrations(res.data.integrations || []);
      setAiSettings(settingsRes.data);
    } catch {
      console.error('Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const available = [
    { id: 'google_sheets', name: t('integrations.google_sheets_name'), type: t('integrations.reporting'), icon: 'table_chart', color: 'green', desc: t('integrations.google_sheets_desc') },
    { id: 'sipuni', name: 'Sipuni', type: 'Telephony', icon: 'phone_in_talk', color: 'blue', desc: 'Sync call recordings and metadata from Sipuni.' },
    { id: 'amocrm', name: 'AmoCRM', type: 'CRM', icon: 'hub', color: 'orange', desc: 'Sync analysis results back to AmoCRM leads.' },
    { id: 'openai', name: 'OpenAI', type: 'AI Provider', icon: 'psychology', color: 'emerald', desc: 'Use OpenAI Whisper and GPT models for analysis.' },
    { id: 'groq', name: 'Groq', type: 'AI Provider', icon: 'bolt', color: 'yellow', desc: 'High-speed Whisper STT provider.' },
    { id: 'gemini', name: 'Google Gemini', type: 'AI Provider', icon: 'cloud', color: 'blue', desc: 'Google Gemini STT and LLM provider.' },
    { id: 'deepgram', name: 'Deepgram', type: 'AI Provider', icon: 'graphic_eq', color: 'purple', desc: 'Enterprise-grade STT provider.' },
    { id: 'elevenlabs', name: 'ElevenLabs', type: 'AI Provider', icon: 'record_voice_over', color: 'purple', desc: 'High-quality STT with diarization.' },
    { id: 'soniox', name: 'Soniox', type: 'AI Provider', icon: 'settings_voice', color: 'blue', desc: 'Accurate and fast speech recognition.' },
    { id: 'telegram', name: t('integrations.telegram_name'), type: t('integrations.notifications'), icon: 'send', color: 'blue', desc: t('integrations.telegram_desc') },
    { id: 'slack', name: t('integrations.slack_name'), type: t('integrations.communication'), icon: 'chat_bubble', color: 'purple', desc: t('integrations.slack_desc') },
  ];

  const isConnected = (type: string) => integrations.some(i => i.integration_type === type && i.is_active);

  const handleConnect = (type: string) => {
      setSelectedType(type);
      setIsModalOpen(true);
  };

  const handleDisconnect = async (type: string) => {
    setActionLoading(type);
    try {
      await integrationApi.delete(type);
      const res = await integrationApi.list();
      setIntegrations(res.data.integrations || []);
      toast.success(t('integrations.disconnect_success', { type }));
    } catch {
      toast.error(t('integrations.disconnect_failed', { type }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAISettings = async () => {
      setIsSavingSettings(true);
      try {
          await integrationApi.updateAISettings(aiSettings);
          toast.success('AI settings updated');
      } catch {
          toast.error('Failed to update AI settings');
      } finally {
          setIsSavingSettings(false);
      }
  };

  if (loading) return (
    <PageLayout title={t('integrations.title')}>
        <div className="p-8">{t('integrations.loading')}</div>
    </PageLayout>
  );

  return (
    <PageLayout title={t('integrations.title')}>
      <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex flex-col gap-2">
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl">{t('integrations.subtitle')}</p>
          </div>
          <button className="bg-primary/10 text-primary hover:bg-primary/20 font-bold px-6 py-3 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto">
            <span className="material-symbols-outlined">add_circle</span>
            {t('integrations.request')}
          </button>
        </div>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">psychology</span>
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">AI Provider Settings</h2>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Transcription (STT)</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default STT Provider</label>
                    <select
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm"
                      value={aiSettings?.stt_provider || 'openai'}
                      onChange={e => setAiSettings({...aiSettings, stt_provider: e.target.value})}
                    >
                      <option value="openai">OpenAI (Whisper)</option>
                      <option value="groq">Groq (Whisper)</option>
                      <option value="deepgram">Deepgram</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="elevenlabs">ElevenLabs</option>
                      <option value="soniox">Soniox</option>
                    </select>
                  </div>
                  <Input
                    label="Default STT Model"
                    placeholder="whisper-1"
                    value={aiSettings?.stt_model || ''}
                    onChange={e => setAiSettings({...aiSettings, stt_model: e.target.value})}
                  />
              </div>

              <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Analysis (LLM)</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default LLM Provider</label>
                    <select
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm"
                      value={aiSettings?.llm_provider || 'openai'}
                      onChange={e => setAiSettings({...aiSettings, llm_provider: e.target.value})}
                    >
                      <option value="openai">OpenAI (GPT)</option>
                      <option value="gemini">Google Gemini</option>
                    </select>
                  </div>
                  <Input
                    label="Default LLM Model"
                    placeholder="gpt-4-turbo-preview"
                    value={aiSettings?.llm_model || ''}
                    onChange={e => setAiSettings({...aiSettings, llm_model: e.target.value})}
                  />
              </div>
            </div>
            <div className="flex justify-end">
                <Button onClick={handleSaveAISettings} isLoading={isSavingSettings}>Save AI Settings</Button>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-green-500">check_circle</span>
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">{t('integrations.connected')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.filter(i => i.is_active).map(i => (
              <div key={i.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">{t('integrations.active')}</span>
                  {i.last_checked_at && (
                    <span className="text-[9px] text-slate-400 italic">
                      {t('integrations.last_checked', { time: new Date(i.last_checked_at).toLocaleTimeString() })}
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-4 mb-6">
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl">hub</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-slate-900 dark:text-white font-bold text-lg">{i.integration_type}</h3>
                      <span className={`size-2 rounded-full ${i.status_message ? 'bg-red-500' : 'bg-green-500'}`} title={i.status_message || 'OK'}></span>
                    </div>
                    <p className="text-slate-400 text-sm">{t('integrations.crm_connector')}</p>
                    {i.status_message && <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]">{i.status_message}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleConnect(i.integration_type)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">settings</span>
                    {t('integrations.configure')}
                  </button>
                  <button
                    onClick={() => handleDisconnect(i.integration_type)}
                    disabled={actionLoading === i.integration_type}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
            {integrations.filter(i => i.is_active).length === 0 && <p className="text-slate-500 col-span-full">{t('integrations.no_active')}</p>}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">apps</span>
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">{t('integrations.available')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map(app => (
              <div key={app.id} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-all flex flex-col ${isConnected(app.id) ? 'opacity-50 grayscale' : 'hover:border-primary/30'}`}>
                <div className="flex items-start gap-4 mb-4">
                  <div className={`size-12 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-primary text-3xl`}>{app.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{app.name}</h3>
                    <p className="text-slate-400 text-sm">{app.type}</p>
                  </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 flex-1">{app.desc}</p>
                <button
                  onClick={() => handleConnect(app.id)}
                  disabled={isConnected(app.id) || actionLoading === app.id}
                  className="w-full bg-primary text-white hover:bg-primary/90 font-bold py-2.5 rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition-all disabled:bg-slate-300"
                >
                  {actionLoading === app.id ? (
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <span className="material-symbols-outlined text-base">add</span>
                  )}
                  {isConnected(app.id) ? t('integrations.connected_status') : t('integrations.connect_now')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedType && (
            <IntegrationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type={selectedType}
                onSuccess={fetchIntegrations}
            />
        )}
      </div>
    </PageLayout>
  );
};

export default IntegrationsPage;
