export interface LeaderboardEntry {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_errors_free: number;
  avg_overall_rating: number;
  avg_kpi: number;
  total_duration_minutes: number;
}

export type SortKey =
  | "avg_kpi"
  | "avg_quality"
  | "avg_script_match"
  | "avg_errors_free"
  | "total_calls";

export type Period = "" | "7d" | "30d" | "90d";
export type Source = "" | "google_sheets" | "sipuni";
