export interface ManagerPerformance {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_errors_free?: number;
  avg_kpi: number;
  avg_overall_rating?: number;
  total_duration_seconds?: number;
  avg_duration_seconds?: number;
  excellent_calls_count?: number;
  external_id?: string;
}
