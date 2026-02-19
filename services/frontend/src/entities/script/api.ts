import { api } from '../../shared/api/base';
import type { Script } from './types';

export const scriptApi = {
  upload: (formData: FormData) => api.post('/scripts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  list: () => api.get<{ scripts: Script[] }>('/scripts'),
  download: (id: string) => api.get(`/scripts/${id}/download`, { responseType: 'blob' }),
  delete: (id: string) => api.delete(`/scripts/${id}`),
};
