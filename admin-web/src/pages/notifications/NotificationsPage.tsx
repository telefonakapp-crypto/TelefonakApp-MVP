import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchAdminNotifications,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
} from '../../services/notificationService';
import type { AdminNotification } from '../../types/notification';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => fetchAdminNotifications({ limit: 50, offset: 0 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markAdminNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllAdminNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });

  const items = listQuery.data?.items ?? [];
  const unreadCount = items.filter((item) => !item.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500">
            Moderation alerts for your Admin Web account
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllMutation.mutate()}
          disabled={unreadCount === 0 || markAllMutation.isPending}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark all read
        </button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading notifications…</p>
      ) : listQuery.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load notifications
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No notifications yet</p>
          <p className="mt-1 text-sm text-slate-500">
            New listing submissions will appear here for active staff.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onMarkRead={() => markReadMutation.mutate(item.id)}
              marking={markReadMutation.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onMarkRead,
  marking,
}: {
  item: AdminNotification;
  onMarkRead: () => void;
  marking: boolean;
}) {
  return (
    <li
      className={`px-4 py-3 ${item.is_read ? 'bg-white' : 'bg-slate-50'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            {!item.is_read ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                New
              </span>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
            {item.message}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {formatDate(item.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {item.related_listing_id ? (
            <Link
              to="/listings"
              className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Open listings · #{item.related_listing_id}
            </Link>
          ) : null}
          {!item.is_read ? (
            <button
              type="button"
              onClick={onMarkRead}
              disabled={marking}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
            >
              Mark read
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
