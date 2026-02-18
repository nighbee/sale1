export interface Company {
  id: string;
  name: string;
  settings?: unknown;
  stt_model_preference?: string;
  llm_provider?: string;
  created_at?: string;
}
