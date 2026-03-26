import { api } from '../../shared/api/base';
import type { Integration } from './types';

export const integrationApi = {
  save: (data: unknown) => api.post<Integration>('/integrations', data),
  list: () => api.get<{ integrations: Integration[] }>('/integrations'),
  get: (type: string) => api.get<Integration>(`/integrations/${type}`),
  delete: (type: string) => api.delete(`/integrations/${type}`),
  triggerSheetSync: () => api.post('/integrations/google-sheets/sync'),
  test: (type: string, data?: { credentials?: unknown; config?: unknown }) => api.post<{ success: boolean; message?: string; error?: string }>(`/integrations/${type}/test`, data),
};
