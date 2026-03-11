import { useState, useEffect, useCallback } from 'react';
import { companyApi } from '../api';
import type { Company, Billing } from '../types';

export const useCompany = (companyId: string) => {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await companyApi.getCompany(companyId);
      setCompany(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const updateSettings = async (data: Partial<Company>) => {
    await companyApi.updateSettings(companyId, data);
    await fetchCompany();
  };

  return { company, loading, updateSettings, fetchCompany };
};

export const useBilling = (companyId: string) => {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBilling = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await companyApi.getBilling(companyId);
      setBilling(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const updateBilling = async (data: Partial<Billing>) => {
    await companyApi.updateBilling(companyId, data);
    await fetchBilling();
  };

  return { billing, loading, updateBilling, fetchBilling };
};
