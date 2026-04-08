import { useState, useEffect, useCallback } from 'react';
import { companyApi } from '../api';
import type { Company, Billing } from '../types';

export const useCompany = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.getCompany();
      setCompany(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const updateSettings = async (data: Partial<Company>) => {
    await companyApi.updateSettings(data);
    await fetchCompany();
  };

  return { company, loading, updateSettings, fetchCompany, setCompany };
};

export const useBilling = () => {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.getBilling();
      setBilling(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const updateBilling = async (data: Partial<Billing>) => {
    await companyApi.updateBilling(data);
    await fetchBilling();
  };

  return { billing, loading, updateBilling, fetchBilling, setBilling };
};
