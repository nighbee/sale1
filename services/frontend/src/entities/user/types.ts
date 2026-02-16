export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}
