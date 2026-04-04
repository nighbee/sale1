import { useState, useCallback } from 'react';
import { integrationApi } from '../../../entities/integration/api';

export const useGetModels = (type: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async (credentials?: any) => {
    if (!['openai', 'groq', 'deepgram', 'gemini', 'elevenlabs', 'soniox'].includes(type)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await integrationApi.getModels(type, { credentials });
      setModels(res.data.models || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch models');
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  return { isLoading, models, error, fetchModels };
};
