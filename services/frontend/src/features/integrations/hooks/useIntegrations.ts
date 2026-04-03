import { useState, useEffect, useCallback } from 'react';
import { integrationApi } from '../../../entities/integration/api';
import type { Integration } from '../../../entities/integration/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface AISettings {
  id: string;
  stt_provider: string;
  stt_model?: string;
  stt_language?: string;
  llm_provider: string;
  llm_model?: string;
  circuit_breaker_enabled: boolean;
}

export const useIntegrations = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const [res, settingsRes] = await Promise.all([
          integrationApi.list(),
          integrationApi.getAISettings()
      ]);
      setIntegrations(res.data.integrations || []);
      setAiSettings(settingsRes.data);
    } catch {
      console.error('Failed to fetch integrations');
      toast.error(t('integrations.fetch_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const disconnect = async (type: string) => {
    setActionLoading(type);
    try {
      await integrationApi.delete(type);
      await fetchIntegrations();
      toast.success(t('integrations.disconnect_success', { type }));
    } catch {
      toast.error(t('integrations.disconnect_failed', { type }));
    } finally {
      setActionLoading(null);
    }
  };

  const saveAISettings = async (settings: any) => {
    setIsSavingSettings(true);
    try {
      await integrationApi.updateAISettings(settings);
      setAiSettings(settings);
      toast.success(t('integrations.settings_updated'));
    } catch {
      toast.error(t('integrations.settings_update_failed'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const isConnected = (type: string) => integrations.some(i => i.integration_type === type && i.is_active);

  return {
    integrations,
    loading,
    actionLoading,
    aiSettings,
    isSavingSettings,
    fetchIntegrations,
    disconnect,
    saveAISettings,
    isConnected,
    setAiSettings
  };
};
