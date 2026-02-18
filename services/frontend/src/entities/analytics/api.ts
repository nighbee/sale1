import { api } from "@shared/api/base";
import type { TeamPerformanceResponse, LeaderboardResponse } from './types';

export const analyticsApi = {
  getTeamPerformance: (period?: string) =>
    api.get<TeamPerformanceResponse>('/analytics/team-performance', { params: { period } }),
  getLeaderboard: () => api.get<LeaderboardResponse>('/analytics/leaderboard'),
};
