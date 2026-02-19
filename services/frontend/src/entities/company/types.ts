export interface Company {
  id: string;
  name: string;
  settings?: unknown;
  stt_model_preference?: string;
  llm_provider?: string;
  created_at?: string;
  description?: string;
  industry?: string;
  size?: string;
  subscription_tier?: string;
  time_zone?: string;
}

export interface Billing {
  card_type?: string;
  card_number_masked?: string;
  card_holder_name?: string;
  expiration_date?: string;
  tokens_used: number;
  tokens_limit: number;
}
