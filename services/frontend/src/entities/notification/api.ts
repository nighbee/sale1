import { api } from '../../shared/api/base';

export const notificationApi = {
  list: () => api.get<{ notifications: any[] }>('/notifications'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
};
