export interface Integration {
  id: string;
  integration_type: string;
  config: unknown;
  is_active: boolean;
}
