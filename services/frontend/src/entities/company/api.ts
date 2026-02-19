import { api } from '../../shared/api/base';
import type { Company, Billing } from './types';

export const companyApi = {
  updateSettings: (id: string, data: Partial<Company>) => api.put<Company>(`/companies/${id}/settings`, data),
  getCompany: (id: string) => api.get<Company>(`/companies/${id}`),
  getBilling: (id: string) => api.get<Billing>(`/companies/${id}/billing`),
  updateBilling: (id: string, data: Partial<Billing>) => api.put<Billing>(`/companies/${id}/billing`, data),
  listCompanies: () => api.get<{ companies: Company[] }>('/companies'),
};
