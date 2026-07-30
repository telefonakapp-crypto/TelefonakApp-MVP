export type AdminRole =
  | 'super_admin'
  | 'moderator'
  | 'marketing'
  | 'support'
  | 'viewer';

/** Admin Web account from /api/admin/auth (admins table). */
export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  updated_by?: number | null;
};

export type AuthSession = {
  token: string;
  user: AdminUser;
};
