export interface Call {
  id: string;
  duration: number;
  status: string;
  timestamp: string;
  rep_id: string;
  team_id: string;
  customer_phone?: string;
  score?: number;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  transcript: string;
}

export interface CallAnalysis {
  id: string;
  call_id: string;
  summary: string;
  sentiment: string;
  objections: string[];
  next_steps: string[];
}
