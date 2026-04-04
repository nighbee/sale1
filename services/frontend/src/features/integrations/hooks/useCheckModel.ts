import { useState, useCallback } from 'react';
import { integrationApi } from '../../../entities/integration/api';
import { toast } from 'sonner';

export const useCheckModel = (type: string) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ success: boolean; transcript?: string; error?: string } | null>(null);

  const checkModel = useCallback(async (credentials?: any, model?: string) => {
    setIsChecking(true);
    setCheckResult(null);
    try {
      const res = await integrationApi.checkModel(type, { credentials, model });
      if (res.data.success) {
        setCheckResult({ success: true, transcript: res.data.transcript });
        toast.success('Model check successful');
      } else {
        setCheckResult({ success: false, error: res.data.error || 'Model check failed' });
        toast.error(res.data.error || 'Model check failed');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to reach check endpoint';
      setCheckResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsChecking(false);
    }
  }, [type]);

  return { isChecking, checkResult, checkModel, setCheckResult };
};
