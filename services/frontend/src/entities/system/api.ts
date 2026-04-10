import { api } from '../../shared/api/base';
import type { QueueStatus } from './types';

export const systemApi = {
  getStatus: () => api.get<QueueStatus>('/system/status'),
};
