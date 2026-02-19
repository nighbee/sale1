export interface Company {
  id: string;
  name: string;
  tenant_id: string;
  subscription_id: string;
  status: "active" | "inactive";
  created_at?: string;
  updated_at: string;
  deleted_at?: string;
  stt_model_preference?: string;
  llm_provider?: string;
}
