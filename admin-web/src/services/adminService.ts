import apiClient from './apiClient';
import type {
  AdminListItem,
  AdminsListResponse,
  AdminsQueryParams,
  CreateAdminPayload,
  UpdateAdminPayload,
} from '../types/admin';

export async function fetchAdmins(
  params: AdminsQueryParams = {}
): Promise<AdminsListResponse> {
  const { data } = await apiClient.get<AdminsListResponse>('/admin/admins', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search || undefined,
      role: params.role || undefined,
      status: params.status || undefined,
    },
  });
  return data;
}

export async function createAdmin(
  payload: CreateAdminPayload
): Promise<AdminListItem> {
  const { data } = await apiClient.post<{ admin: AdminListItem }>(
    '/admin/admins',
    payload
  );
  return data.admin;
}

export async function updateAdmin(
  id: number,
  payload: UpdateAdminPayload
): Promise<AdminListItem> {
  const { data } = await apiClient.put<{ admin: AdminListItem }>(
    `/admin/admins/${id}`,
    payload
  );
  return data.admin;
}

export async function resetAdminPassword(
  id: number,
  password: string
): Promise<void> {
  await apiClient.post(`/admin/admins/${id}/reset-password`, { password });
}

export async function disableAdmin(id: number): Promise<AdminListItem> {
  const { data } = await apiClient.delete<{ admin: AdminListItem }>(
    `/admin/admins/${id}`
  );
  return data.admin;
}
