import apiClient from './apiClient';
import type {
  MarketplaceUserListItem,
  UserDetailResponse,
  UsersListResponse,
  UsersQueryParams,
} from '../types/user';

export async function fetchUsers(
  params: UsersQueryParams = {}
): Promise<UsersListResponse> {
  const { data } = await apiClient.get<UsersListResponse>('/admin/users', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search || undefined,
      status: params.status || undefined,
      sort: params.sort || undefined,
    },
  });
  return data;
}

export async function fetchUserDetail(id: number): Promise<UserDetailResponse> {
  const { data } = await apiClient.get<UserDetailResponse>(`/admin/users/${id}`);
  return data;
}

export async function updateUserStatus(
  id: number,
  isActive: boolean
): Promise<MarketplaceUserListItem> {
  const { data } = await apiClient.put<{ user: MarketplaceUserListItem }>(
    `/admin/users/${id}/status`,
    { is_active: isActive }
  );
  return data.user;
}
