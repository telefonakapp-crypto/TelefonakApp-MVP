import apiClient from './apiClient';
import type {
  AdminNotification,
  AdminNotificationsListResponse,
  AdminNotificationsQueryParams,
} from '../types/notification';

export async function fetchAdminNotifications(
  params: AdminNotificationsQueryParams = {}
): Promise<AdminNotificationsListResponse> {
  const { data } = await apiClient.get<AdminNotificationsListResponse>(
    '/admin/notifications',
    {
      params: {
        limit: params.limit,
        offset: params.offset,
        unread_only: params.unread_only ? 'true' : undefined,
      },
    }
  );
  return data;
}

export async function fetchAdminUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ unread: number }>(
    '/admin/notifications/unread-count'
  );
  return data.unread;
}

export async function markAdminNotificationRead(
  id: number
): Promise<AdminNotification> {
  const { data } = await apiClient.patch<{ notification: AdminNotification }>(
    `/admin/notifications/${id}/read`
  );
  return data.notification;
}

export async function markAllAdminNotificationsRead(): Promise<{
  updated: number;
  unread: number;
}> {
  const { data } = await apiClient.patch<{ updated: number; unread: number }>(
    '/admin/notifications/read-all'
  );
  return data;
}
