import { api } from '../../shared/api/base';
import type { Company, Billing } from './types';

export const companyApi = {
  updateSettings: (data: Partial<Company>) => api.put<Company>(`/settings`, data),
  getCompany: () => api.get<Company>(`/settings`),
  getBilling: () => api.get<Billing>(`/settings/billing`),
  updateBilling: (data: Partial<Billing>) => api.put<Billing>(`/settings/billing`, data),
  listCompanies: () => api.get<{ companies: Company[] }>('/companies'),
};
