import { api } from "@shared/api/base";
import type { Script } from './types';

export const scriptApi = {
  upload: (formData: FormData) => api.post<{ script: Script }>('/scripts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  list: () => api.get<{ scripts: Script[] }>('/scripts'),
  delete: (id: string) => api.delete(`/scripts/${id}`),
};
