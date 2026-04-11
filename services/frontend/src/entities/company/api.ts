import { api } from '../../shared/api/base';
import type { Company, Billing } from './types';
import type { User } from '../user/types';
import type { Integration } from '../integration/types';

export const companyApi = {
  updateSettings: (data: Partial<Company>) => api.put<Company>(`/settings`, data),
  getCompany: () => api.get<Company>(`/settings`),
  getBilling: () => api.get<Billing>(`/settings/billing`),
  updateBilling: (data: Partial<Billing>) => api.put<Billing>(`/settings/billing`, data),
  listCompanies: () => api.get<{ companies: Company[] }>('/companies'),
  listAllCompanies: (params?: unknown) => api.get<{ companies: Company[]; total: number }>('/admin/companies', { params }),
  getCompanyDetails: (id: string) => api.get<{ company: Company; users: User[]; integrations: Integration[] }>(`/admin/companies/${id}`),
  updateCompanyGlobal: (id: string, data: Partial<Company>) => api.put<Company>(`/admin/companies/${id}`, data),
};
