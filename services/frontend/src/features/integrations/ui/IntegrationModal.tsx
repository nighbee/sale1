import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../shared/ui/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { integrationApi } from '../../../entities/integration/api';
import { useCheckModel } from '../hooks/useCheckModel';
import { useGetModels } from '../hooks/useGetModels';
import { toast } from 'sonner';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: string;
  onSuccess: () => void;
}

const IntegrationModal: React.FC<IntegrationModalProps> = ({ isOpen, onClose, type, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const { isChecking, checkResult, checkModel, setCheckResult } = useCheckModel(type);
  const { isLoading: isFetchingModels, models, error: modelsError, fetchModels } = useGetModels(type);

  useEffect(() => {
    const fetchIntegration = async () => {
        try {
            const res = await integrationApi.get(type);
            const creds = (res.data.credentials as Record<string, string>) || {};
            const cfg = (res.data.config as Record<string, string>) || {};
            setCredentials(creds);
            setConfig(cfg);

            // Auto fetch models if credentials exist
            if (creds.api_key) {
              fetchModels(creds);
            }
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

  useEffect(() => {
    // Re-fetch models when credentials change and have an API key
    if (credentials.api_key && credentials.api_key.length > 10) {
      const timeoutId = setTimeout(() => {
        fetchModels(credentials);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [credentials.api_key]);

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
    checkModel(credentials, config.model);
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
                        <div className="w-full">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
                          <div className="relative">
                            <select
                                className="appearance-none block w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200"
                                value={config.model || ''}
                                onChange={e => setConfig({...config, model: e.target.value})}
                                disabled={isFetchingModels}
                            >
                                <option value="">Select Model</option>
                                {models.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                                {!models.includes(config.model) && config.model && (
                                    <option value={config.model}>{config.model}</option>
                                )}
                            </select>
                            {isFetchingModels && (
                              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full block"></span>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                <span className="material-symbols-outlined text-base">expand_more</span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
                          <div className="relative">
                            <select
                                className="appearance-none block w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 dark:text-white transition-all duration-200"
                                value={config.language || ''}
                                onChange={e => setConfig({...config, language: e.target.value})}
                            >
                                <option value="auto">Auto Detect</option>
                                <option value="kk">Kazakh (kk)</option>
                                <option value="ru">Russian (ru)</option>
                                <option value="en">English (en)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                <span className="material-symbols-outlined text-base">expand_more</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">info</span>
                          Transcription Strategy
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          {type === 'openai' && 'Uses Whisper-1 model. High accuracy, no diarization support.'}
                          {type === 'groq' && 'Uses Whisper models via Groq. Extremely fast execution (~10s for 1h audio). No diarization.'}
                          {type === 'deepgram' && 'Uses Nova-2 model. High speed, supports diarization and punctuation.'}
                          {type === 'gemini' && 'Uses Gemini Multimodal LLM. Excellent at context and Kazakh language. Supports diarization.'}
                          {type === 'elevenlabs' && 'Uses Scribe v2. High accuracy and natural punctuation. Supports diarization.'}
                          {type === 'soniox' && 'Enterprise-grade STT. High accuracy in noisy environments. Supports diarization.'}
                        </p>
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

        {modelsError && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            <div>
              <p className="font-bold">Failed to fetch models</p>
              <p>{modelsError}</p>
            </div>
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
            {['groq', 'deepgram', 'gemini', 'elevenlabs', 'soniox'].includes(type) && (
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
