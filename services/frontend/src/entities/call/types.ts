export interface Call {
  id: string;
  duration: number;
  status: string;
  timestamp: string;
  rep_id: string;
  team_id: string;
  customer_phone?: string;
  score?: number;
  call_date?: string;
  manager_name?: string;
  audio_url?: string;
}

export interface CallTranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  transcript: string;
  segments?: CallTranscriptSegment[];
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
  recommendation?: string;
}
