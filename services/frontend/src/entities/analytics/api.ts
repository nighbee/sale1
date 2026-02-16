import { api } from '../../shared/api/base';

export const analyticsApi = {
  getTeamPerformance: (period?: string) => api.get<Record<string, unknown>>('/analytics/team-performance', { params: { period } }),
  getLeaderboard: () => api.get<Record<string, unknown>>('/analytics/leaderboard'),
};
