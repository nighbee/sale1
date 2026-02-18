export interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  time_zone?: string;
  settings?: unknown;
  stt_model_preference?: string;
  llm_provider?: string;
  created_at?: string;
}
