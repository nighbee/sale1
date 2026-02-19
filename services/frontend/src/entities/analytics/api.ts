import { api } from '../../shared/api/base';

export const analyticsApi = {
  getTeamPerformance: (params?: Record<string, unknown>) => api.get<Record<string, unknown>>('/analytics/team-performance', { params }),
  getLeaderboard: (params?: Record<string, unknown>) => api.get<Record<string, unknown>>('/analytics/leaderboard', { params }),
  exportLeaderboard: (format: string, params?: Record<string, unknown>) => api.get(`/analytics/leaderboard/export/${format}`, { params, responseType: 'blob' }),
};
