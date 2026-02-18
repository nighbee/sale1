import { api } from "@shared/api/base";
import type { Team } from './types';

export const teamApi = {
  create: (data: unknown) => api.post<Team>('/teams', data),
  list: () => api.get<{ teams: Team[] }>('/teams'),
  get: (id: string) => api.get<Team>(`/teams/${id}`),
  update: (id: string, data: unknown) => api.put<Team>(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
};
