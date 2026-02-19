export interface Integration {
  id: string;
  integration_type: string;
  credentials?: any;
  config: any;
  is_active: boolean;
}
