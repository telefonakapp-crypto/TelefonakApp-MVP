import apiClient from './apiClient';
import type {
  AuditLogItem,
  AuditLogsListResponse,
  AuditLogsQueryParams,
} from '../types/audit';

export async function fetchAuditLogs(
  params: AuditLogsQueryParams = {}
): Promise<AuditLogsListResponse> {
  const { data } = await apiClient.get<AuditLogsListResponse>('/admin/audit-logs', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      action: params.action || undefined,
      entity_type: params.entity_type || undefined,
      admin: params.admin || undefined,
      search: params.search || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
    },
  });
  return data;
}

export async function fetchAuditLogDetail(id: number): Promise<AuditLogItem> {
  const { data } = await apiClient.get<{ log: AuditLogItem }>(
    `/admin/audit-logs/${id}`
  );
  return data.log;
}
