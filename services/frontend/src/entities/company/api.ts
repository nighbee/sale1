import { api } from '../../shared/api/base';
import type { Company, Billing } from './types';

export const companyApi = {
  updateSettings: (data: Partial<Company>) => api.put<Company>(`/settings`, data),
  getCompany: () => api.get<Company>(`/settings`),
  getBilling: () => api.get<Billing>(`/settings/billing`),
  updateBilling: (data: Partial<Billing>) => api.put<Billing>(`/settings/billing`, data),
  listCompanies: () => api.get<{ companies: Company[] }>('/companies'),
  listAllCompanies: () => api.get<{ companies: Company[] }>('/admin/companies'),
  updateCompanyGlobal: (id: string, data: Partial<Company>) => api.put<Company>(`/admin/companies/${id}`, data),
};
