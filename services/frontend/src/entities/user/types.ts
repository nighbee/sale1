export interface User {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  last_login?: string;
  manager_id?: string;
  manager_name?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
