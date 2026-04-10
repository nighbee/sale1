export interface Call {
  id: string;
  duration: number;
  status: string;
  timestamp: string;
  rep_id: string;
  team_id: string;
  customer_phone?: string;
  score?: number;
  manager_id?: string;
  manager_name?: string;
  client_phone?: string;
  call_date: string;
  call_link?: string;
  storage_link?: string;
  source?: string;
  audio_url?: string;
  // Analysis scores – joined from analysis_reports in list query
  quality_score?: number;
  script_match?: number;
  errors_free?: number;
  company_id?: string;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  transcript: string;
  segments?: TranscriptSegment[];
}

export interface CallAnalysis {
  id: string;
  call_id: string;
  summary: string;
  sentiment: string;
  objections: string[];
  next_steps: string[];
  quality_score?: number;
  script_match?: number;
  errors_free?: number;
  overall_rating?: number;
  kpi?: number;
  recommendation?: string;
  brief?: string;
  next_best_action?: string;
}

export interface ListCallsResponse {
  calls: Call[];
  total: number;
  page: number;
  limit: number;
  status_counts: Record<string, number>;
}
