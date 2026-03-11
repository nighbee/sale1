import { api } from '../../shared/api/base';
import type { Notification } from './types';

export const notificationApi = {
  list: () => api.get<{ notifications: Notification[] }>('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};
