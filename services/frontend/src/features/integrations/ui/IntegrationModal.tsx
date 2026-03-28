import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../shared/ui/Modal';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { integrationApi } from '../../../entities/integration/api';
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
    }
  }, [isOpen, type]);

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
              return (
                  <div className="space-y-4">
                      <Input label="API Key" type="password" value={credentials.api_key || ''} onChange={e => setCredentials({...credentials, api_key: e.target.value})} />
                      <Input
                          label="Base URL (Optional)"
                          placeholder="https://api.openai.com/v1"
                          value={credentials.base_url || ''}
                          onChange={e => setCredentials({...credentials, base_url: e.target.value})}
                      />
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

        <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={handleTest} isLoading={isTesting} disabled={loading}>
            {t('integrations.test_connection')}
          </Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} isLoading={loading}>{t('common.save')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default IntegrationModal;
