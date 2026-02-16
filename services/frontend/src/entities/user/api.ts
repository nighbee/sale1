import { api } from '../../shared/api/base';
import type { User, AuthResponse } from './types';

export const userApi = {
  login: (data: Record<string, unknown>) => api.post<AuthResponse>('/auth/login', data),
  register: (data: Record<string, unknown>) => api.post<AuthResponse>('/auth/register', data),
  invite: (data: Record<string, unknown>) => api.post('/users/invite', data),
  listUsers: () => api.get<{ users: User[] }>('/users'),
};
