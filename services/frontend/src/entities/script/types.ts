export interface Script {
  id: string;
  name: string;
  created_at: string;
  team_id?: string;
  version?: number;
  is_active?: boolean;
}
