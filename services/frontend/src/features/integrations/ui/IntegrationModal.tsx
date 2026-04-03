import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../shared/ui/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { integrationApi } from '../../../entities/integration/api';
import { useCheckModel } from '../hooks/useCheckModel';
import { toast } from 'sonner';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: string;
  onSuccess: () => void;
}

const STT_MODELS: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'whisper-1', name: 'Whisper 1 (General)' },
  ],
  groq: [
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo (Fast)' },
    { id: 'whisper-large-v3', name: 'Whisper Large v3' },
    { id: 'distil-whisper-large-v3-en', name: 'Distil-Whisper Large v3 (English Only)' },
  ],
  deepgram: [
    { id: 'nova-2', name: 'Nova-2 (Best Performance)' },
    { id: 'nova-2-phonecall', name: 'Nova-2 Phonecall' },
    { id: 'base', name: 'Base' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
  ],
  elevenlabs: [
    { id: 'scribe_v2', name: 'Scribe v2' },
    { id: 'scribe_v1', name: 'Scribe v1' },
  ],
  soniox: [
    { id: 'en_v2', name: 'English v2' },
    { id: 'ru_v1', name: 'Russian v1' },
  ]
};

const LANGUAGES = [
  { id: '', name: 'Auto-detect' },
  { id: 'en', name: 'English' },
  { id: 'ru', name: 'Russian' },
  { id: 'kk', name: 'Kazakh' },
];

const IntegrationModal: React.FC<IntegrationModalProps> = ({ isOpen, onClose, type, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const { isChecking, checkResult, checkModel, setCheckResult } = useCheckModel(type);

  useEffect(() => {
    const fetchIntegration = async () => {
        try {
            const res = await integrationApi.get(type);
            setCredentials((res.data.credentials as Record<string, string>) || {});
            setConfig((res.data.config as Record<string, string>) || {});
        } catch {
            setCredentials({});
            setConfig({});
        }
    }
    if (isOpen) {
        fetchIntegration();
        setCheckResult(null);
        setTestResult(null);
    }
  }, [isOpen, type, setCheckResult]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await integrationApi.test(type, { credentials, config });
      if (res.data.success) {
        setTestResult({ success: true, message: res.data.message || 'Connection successful' });
        toast.success('Connection test successful');
      } else {
        setTestResult({ success: false, message: res.data.error || 'Connection failed' });
        toast.error(res.data.error || 'Connection test failed');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to reach test endpoint';
      setTestResult({ success: false, message: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCheckModel = () => {
    checkModel(credentials, config.model, config.language);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await integrationApi.save({
          integration_type: type,
          credentials,
          config,
          is_active: true
      });
      toast.success(t('integrations.connect_success', { type }));
      onSuccess();
      onClose();
    } catch {
      toast.error(t('integrations.connect_failed', { type }));
    } finally {
      setLoading(false);
    }
  };

  const renderFields = () => {
      switch (type) {
          case 'google_sheets':
              return (
                  <div className="space-y-4">
                      <Input label="Spreadsheet ID" value={config.spreadsheet_id || ''} onChange={e => setConfig({...config, spreadsheet_id: e.target.value})} />
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Account JSON</label>
                          <textarea
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                              rows={8}
                              value={typeof credentials === 'string' ? credentials : JSON.stringify(credentials, null, 2)}
                              onChange={e => {
                                  try {
                                      const parsed = JSON.parse(e.target.value);
                                      setCredentials(parsed);
                                  } catch {
                                      // Allow typing invalid JSON temporarily
                                      setCredentials(e.target.value as any);
                                  }
                              }}
                              placeholder='{ "type": "service_account", ... }'
                          />
                      </div>
                  </div>
              );
          case 'sipuni':
              return (
                  <div className="space-y-4">
                      <Input label="API Key" type="password" value={credentials.api_key || ''} onChange={e => setCredentials({...credentials, api_key: e.target.value})} />
                  </div>
              );
          case 'openai':
          case 'groq':
          case 'deepgram':
          case 'gemini':
          case 'elevenlabs':
          case 'soniox':
              return (
                  <div className="space-y-4">
                      <Input label="API Key" type="password" value={credentials.api_key || ''} onChange={e => setCredentials({...credentials, api_key: e.target.value})} />
                      {['openai', 'groq', 'deepgram', 'gemini'].includes(type) && (
                          <Input
                              label="Base URL (Optional)"
                              placeholder="https://api.openai.com/v1"
                              value={credentials.base_url || ''}
                              onChange={e => setCredentials({...credentials, base_url: e.target.value})}
                          />
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
                          <select
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-white"
                            value={config.model || ''}
                            onChange={e => setConfig({...config, model: e.target.value})}
                          >
                            <option value="">Select a model</option>
                            {STT_MODELS[type]?.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                            {!STT_MODELS[type]?.find(m => m.id === config.model) && config.model && (
                              <option value={config.model}>{config.model} (Custom)</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
                          <select
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-white"
                            value={config.language || ''}
                            onChange={e => setConfig({...config, language: e.target.value})}
                          >
                            {LANGUAGES.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                  </div>
              );
          case 'slack':
              return (
                  <div className="space-y-4">
                      <Input label="Webhook URL" value={credentials.webhook_url || ''} onChange={e => setCredentials({...credentials, webhook_url: e.target.value})} />
                      <Input label="Channel Name" value={config.channel || ''} onChange={e => setConfig({...config, channel: e.target.value})} />
                  </div>
              );
          case 'telegram':
              return (
                  <div className="space-y-4">
                      <Input label="Bot Token" value={credentials.bot_token || ''} onChange={e => setCredentials({...credentials, bot_token: e.target.value})} />
                      <Input label="Chat ID" value={config.chat_id || ''} onChange={e => setConfig({...config, chat_id: e.target.value})} />
                  </div>
              );
          case 'amocrm':
              return (
                  <div className="space-y-4">
                      <Input label="Subdomain" value={config.subdomain || ''} onChange={e => setConfig({...config, subdomain: e.target.value})} />
                      <Input label="Client ID" value={credentials.client_id || ''} onChange={e => setCredentials({...credentials, client_id: e.target.value})} />
                      <Input label="Client Secret" type="password" value={credentials.client_secret || ''} onChange={e => setCredentials({...credentials, client_secret: e.target.value})} />
                  </div>
              );
          default:
              return <p>No specific configuration needed for {type}. Just click save to enable.</p>;
      }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Configure ${type}`}>
      <div className="space-y-6">
        {renderFields()}

        {testResult && (
          <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <span className="material-symbols-outlined text-base mt-0.5">{testResult.success ? 'check_circle' : 'error'}</span>
            <p>{testResult.message}</p>
          </div>
        )}

        {checkResult && (
          <div className={`p-3 rounded-lg text-sm flex flex-col gap-2 ${checkResult.success ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base mt-0.5">{checkResult.success ? 'verified' : 'error'}</span>
              <p className="font-bold">{checkResult.success ? 'Sample Transcription:' : 'Model Check Failed'}</p>
            </div>
            {checkResult.success ? (
              <p className="italic bg-white/50 p-2 rounded border border-blue-100 max-h-40 overflow-y-auto">{checkResult.transcript}</p>
            ) : (
              <p>{checkResult.error}</p>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} isLoading={isTesting} disabled={loading || isChecking}>
              {t('integrations.test_connection')}
            </Button>
            {['openai', 'groq', 'deepgram', 'gemini', 'elevenlabs', 'soniox'].includes(type) && (
              <Button variant="outline" onClick={handleCheckModel} isLoading={isChecking} disabled={loading || isTesting}>
                <span className="material-symbols-outlined text-base mr-1">audio_file</span>
                Check model
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={loading || isTesting || isChecking}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} isLoading={loading}>{t('common.save')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default IntegrationModal;
