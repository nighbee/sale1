import { api } from '../../shared/api/base';
import type { Script } from './types';

export const scriptApi = {
  upload: (formData: FormData) => api.post('/scripts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  list: () => api.get<{ scripts: Script[] }>('/scripts'),
  get: (id: string) => api.get<Script>(`/scripts/${id}`),
  getContent: (id: string) => api.get<{ content: string }>(`/scripts/${id}/content`),
  download: (id: string) => api.get<Blob>(`/scripts/${id}/download`, { responseType: 'blob' }),
  update: (id: string, data: Partial<Script>) => api.put<Script>(`/scripts/${id}`, data),
  delete: (id: string) => api.delete(`/scripts/${id}`),
  getBaseScript: () => api.get<Script>('/base-scripts/current'),
  listBaseScripts: () => api.get<{ scripts: Script[] }>('/base-scripts'),
  activateAsBase: (id: string) => api.post(`/base-scripts/${id}/activate`),
  getBaseMetrics: (id: string) => api.get<Record<string, unknown>>(`/base-scripts/${id}/metrics`),
};
