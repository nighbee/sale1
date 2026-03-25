import { api } from '../../shared/api/base';
import type { User, AuthResponse } from './types';
import type { Call } from '../call/types';

export const userApi = {
  login: (data: Record<string, unknown>) => api.post<AuthResponse>('/auth/login', data),
  refresh: () => api.post<AuthResponse>('/auth/refresh'),
  register: (data: Record<string, unknown>) => api.post<AuthResponse>('/auth/register', data),
  invite: (data: Record<string, unknown>) => api.post('/users/invite', data),
  listUsers: () => api.get<{ users: User[] }>('/users'),
  get: (id: string) => api.get<{ user: User }>(`/users/${id}`),
  update: (id: string, data: Partial<User>) => api.put<{ user: User }>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  getMe: () => api.get<User>('/user/me'),
  logout: () => api.post('/auth/logout'),
  getUserCalls: (id: string, params?: unknown) => api.get<{ calls: Call[]; total?: number }>(`/users/${id}/calls`, { params }),
};
