export interface ManagerPerformance {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_kpi: number;
}

export interface TeamPerformanceResponse {
  managers: ManagerPerformance[];
}

export interface LeaderboardResponse {
  leaderboard: ManagerPerformance[];
}
