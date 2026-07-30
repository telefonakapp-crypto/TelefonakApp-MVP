import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchAdminUnreadCount } from '../../services/notificationService';

export function Topbar() {
  const { user, logout } = useAuth();
  const displayName = user?.full_name || user?.email || 'Admin';

  const unreadQuery = useQuery({
    queryKey: ['admin-notifications-unread'],
    queryFn: fetchAdminUnreadCount,
    refetchInterval: 30_000,
  });

  const unread = unreadQuery.data ?? 0;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <h1 className="text-sm font-medium text-slate-700">Admin Panel</h1>
      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          className="relative rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Notifications
          {unread > 0 ? (
            <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
        <span className="hidden text-sm text-slate-600 sm:inline">{displayName}</span>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
