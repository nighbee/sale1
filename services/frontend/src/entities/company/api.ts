import { api } from '../../shared/api/base';
import type { Company } from './types';

export const companyApi = {
  updateSettings: (id: string, data: unknown) => api.put<Company>(`/companies/${id}/settings`, data),
  getCompany: (id: string) => api.get<Company>(`/companies/${id}`),
};
