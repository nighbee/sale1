export interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  type?: string;
}
