import { api } from '../../shared/api/base';
import type { QueueStatus, MetricData, LogEntry } from './types';

export const systemApi = {
  getStatus: () => api.get<QueueStatus>('/admin/system/status'),
  getMetrics: () => api.get<MetricData>('/admin/system/metrics'),
  getLogs: (limit: number = 100) => api.get<LogEntry>('/admin/system/logs', { params: { limit } }),
  listRedisKeys: (pattern?: string) => api.get<{ keys: { key: string; type: string }[] }>('/admin/system/redis', { params: { pattern } }),
  getRedisValue: (key: string) => api.get<{ key: string; value: string }>('/admin/system/redis/value', { params: { key } }),
  updateRedisValue: (key: string, value: string) => api.put('/admin/system/redis', { key, value }),
  deleteRedisKey: (key: string) => api.delete('/admin/system/redis', { params: { key } }),
  clearQueue: (queue: string, all: boolean = false) => api.post('/admin/system/queues/clear', { queue, all }),
  removeQueueItem: (queue: string, item: string) => api.delete('/admin/system/queues/item', { data: { queue, item } }),
};
