export interface Integration {
  id: string;
  integration_type: string;
  credentials?: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
  last_checked_at?: string;
  status_message?: string;
}
