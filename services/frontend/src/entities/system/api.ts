import { api } from '../../shared/api/base';
import type { QueueStatus } from './types';

export const systemApi = {
  getStatus: () => api.get<QueueStatus>('/admin/system/status'),
  listRedisKeys: (pattern?: string) => api.get<{ keys: { key: string; type: string }[] }>('/admin/system/redis', { params: { pattern } }),
  getRedisValue: (key: string) => api.get<{ key: string; value: string }>('/admin/system/redis/value', { params: { key } }),
  updateRedisValue: (key: string, value: string) => api.put('/admin/system/redis', { key, value }),
  deleteRedisKey: (key: string) => api.delete('/admin/system/redis', { params: { key } }),
};
