import { api } from '../../shared/api/base';
import type { Company, Billing } from './types';

export const companyApi = {
  updateSettings: (id: string, data: Partial<Company>) => api.put<Company>(`/settings`, data),
  getCompany: (id: string) => api.get<Company>(`/settings`),
  getBilling: (id: string) => api.get<Billing>(`/settings/billing`),
  updateBilling: (id: string, data: Partial<Billing>) => api.put<Billing>(`/settings/billing`, data),
  listCompanies: () => api.get<{ companies: Company[] }>('/companies'),
};
