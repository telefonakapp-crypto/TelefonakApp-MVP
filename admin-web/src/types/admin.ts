import type { AdminRole, AdminUser } from './auth';

export type { AdminRole, AdminUser };

export type AdminListItem = AdminUser;

export type AdminsPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type AdminsListResponse = {
  items: AdminListItem[];
  pagination: AdminsPagination;
};

export type AdminsQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
};

export type CreateAdminPayload = {
  full_name: string;
  email: string;
  password: string;
  role: AdminRole;
};

export type UpdateAdminPayload = {
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

export type AdminFormValues = {
  full_name: string;
  email: string;
  password: string;
  role: AdminRole;
  is_active: boolean;
};

export const ADMIN_ROLE_OPTIONS: Array<{ value: AdminRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'support', label: 'Support' },
  { value: 'viewer', label: 'Viewer' },
];
