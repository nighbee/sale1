import { api } from '../../shared/api/base';
import type { Integration } from './types';

export const integrationApi = {
  save: (data: unknown) => api.post<Integration>('/integrations', data),
  list: () => api.get<{ integrations: Integration[] }>('/integrations'),
  get: (type: string) => api.get<Integration>(`/integrations/${type}`),
  delete: (type: string) => api.delete(`/integrations/${type}`),
  test: (type: string, data?: { credentials?: unknown; config?: unknown }) => api.post<{ success: boolean; message?: string; error?: string }>(`/integrations/${type}/test`, data),
  checkModel: (type: string, data?: { credentials?: unknown; model?: string }) => api.post<{ success: boolean; transcript?: string; error?: string }>(`/integrations/${type}/check`, data),
  getModels: (type: string, data?: { credentials?: unknown; category?: string }) => api.post<{ models: string[] }>(`/integrations/${type}/models`, data),
  getAISettings: () => api.get<any>('/ai-settings'),
  updateAISettings: (data: any) => api.put<any>('/ai-settings', data),
};
