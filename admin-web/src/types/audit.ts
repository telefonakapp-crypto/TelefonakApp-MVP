import type { AdminUser } from './auth';

export type AuditLogItem = {
  id: number;
  admin_id: number | null;
  admin: AdminUser | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditLogsPagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type AuditLogsFilterOptions = {
  actions: string[];
  entityTypes: string[];
  admins: Array<{ id: number; full_name: string; email: string }>;
};

export type AuditLogsListResponse = {
  items: AuditLogItem[];
  pagination: AuditLogsPagination;
  filters: AuditLogsFilterOptions;
};

export type AuditLogsQueryParams = {
  page?: number;
  limit?: number;
  action?: string;
  entity_type?: string;
  admin?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
};
