export interface Call {
  id: string;
  duration: number;
  status: string;
  timestamp: string;
  rep_id: string;
  team_id: string;
  customer_phone?: string;
  score?: number;
  manager_name?: string;
  call_date: string;
  audio_url?: string;
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
  recommendation?: string;
}
