import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchAdminNotifications,
  fetchAdminUnreadCount,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
} from '../../services/notificationService';
import { fetchListings } from '../../services/listingsService';
import type { AdminNotification } from '../../types/notification';
import { useAuth } from '../../hooks/useAuth';
import {
  formatNotificationDate,
  isWatchDevice,
  matchesCategory,
  notificationSearchText,
  notificationStatus,
  parseAdminNotificationMessage,
  type NotificationCategory,
} from './notificationPresentation';
import { NumberedPagination } from '../../components/pagination/NumberedPagination';

const PAGE_SIZE = 8;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const displayName = user?.full_name || user?.email || 'Admin';
  const email = user?.email || '';

  const listQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => fetchAdminNotifications({ limit: 50, offset: 0 }),
  });

  const pendingListingsQuery = useQuery({
    queryKey: ['admin-listings', { page: 1, limit: 1, status: 'pending' }],
    queryFn: () => fetchListings({ page: 1, limit: 1, status: 'pending' }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const unreadQuery = useQuery({
    queryKey: ['admin-notifications-unread'],
    queryFn: fetchAdminUnreadCount,
    refetchInterval: 30_000,
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

  const items = listQuery.data?.items;
  const itemList = items ?? [];
  const unreadCount = itemList.filter((item) => !item.is_read).length;
  const pendingCount = pendingListingsQuery.data?.pagination.totalItems ?? 0;
  const headerUnread = unreadQuery.data ?? unreadCount;

  const filtered = useMemo(() => {
    const source = items ?? [];
    const needle = search.trim().toLowerCase();
    const next = source.filter((item) => {
      if (!matchesCategory(item, category)) return false;
      if (!needle) return true;
      const parsed = parseAdminNotificationMessage(item.message);
      return notificationSearchText(item, parsed).includes(needle);
    });
    next.sort((a, b) => {
      const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === 'newest' ? -delta : delta;
    });
    return next;
  }, [items, category, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateCategory = (next: NotificationCategory) => {
    setCategory(next);
    setPage(1);
  };

  const pendingTabCount = pendingCount;

  return (
    <div className="min-h-full bg-[#F6F7FB] px-4 py-5 md:px-8 md:py-6">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <nav className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-800">
              Admin Panel
            </Link>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-slate-800">Moderation Notifications</span>
          </nav>
          <label className="relative min-w-0 flex-1 lg:max-w-md">
            <span className="sr-only">Search listings, sellers, IDs</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search listings, sellers, IDs..."
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
            aria-label="Notifications"
          >
            <BellIcon />
            {headerUnread > 0 ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-500" />
            ) : null}
          </Link>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initialsFromName(displayName)}
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-600"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h2>
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {pendingCount} Pending Moderation
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Moderation alerts and incoming submission updates for your Admin Web account
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={unreadCount === 0 || markAllMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckIcon />
              Mark all read
            </button>
            <button
              type="button"
              aria-disabled="true"
              title="Preferences are not available yet"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              <SlidersIcon />
              Preferences
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <CategoryTab
            active={category === 'all'}
            onClick={() => updateCategory('all')}
            label="All Notifications"
          />
          <CategoryTab
            active={category === 'pending'}
            onClick={() => updateCategory('pending')}
            label="Pending Approval"
            count={pendingTabCount}
          />
          <CategoryTab
            active={category === 'system'}
            onClick={() => updateCategory('system')}
            label="System Alerts"
          />
          <CategoryTab
            active={category === 'seller'}
            onClick={() => updateCategory('seller')}
            label="Seller Updates"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <FilterIcon />
            <span className="text-slate-400">Sort:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'newest' | 'oldest');
                setPage(1);
              }}
              className="bg-transparent font-medium text-slate-800 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </label>
          <label className="relative">
            <span className="sr-only">Filter current view</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter current view..."
              className="w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {listQuery.isLoading ? (
          <p className="px-1 text-sm text-slate-500">Loading notifications…</p>
        ) : listQuery.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Unable to load notifications
          </div>
        ) : itemList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No notifications yet</p>
            <p className="mt-1 text-sm text-slate-500">
              New listing submissions will appear here for active staff.
            </p>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No notifications in this view</p>
            <p className="mt-1 text-sm text-slate-500">
              Try another tab or clear the search filter.
            </p>
          </div>
        ) : (
          pageItems.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              marking={markReadMutation.isPending}
              onMarkRead={() => markReadMutation.mutate(item.id)}
            />
          ))
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            Showing {pageItems.length} of {filtered.length} notifications
            {listQuery.data?.pagination.has_more ? ' on this page' : ''}
          </p>
          {totalPages > 1 ? (
            <NumberedPagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function listingHref(listingId: number) {
  return `/listings?listingId=${listingId}`;
}

function NotificationCard({
  item,
  marking,
  onMarkRead,
}: {
  item: AdminNotification;
  marking: boolean;
  onMarkRead: () => void;
}) {
  const parsed = parseAdminNotificationMessage(item.message);
  const status = notificationStatus(item);
  const listingId = item.related_listing_id;
  const watch = isWatchDevice(parsed.device);
  const submitted = formatNotificationDate(parsed.submitted || item.created_at);
  const href = listingId != null ? listingHref(listingId) : null;

  const body = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
        {watch ? <WatchIcon /> : <PhoneIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 pr-6">
          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
          {listingId != null ? (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              #{listingId}
            </span>
          ) : null}
          <StatusPill kind={status.kind} label={status.label} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{parsed.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {parsed.seller ? (
            <span className="text-slate-500">
              Seller: <span className="font-medium text-slate-800">{parsed.seller}</span>
            </span>
          ) : null}
          {parsed.device ? (
            <span className="text-slate-500">
              Device: <span className="font-medium text-slate-800">{parsed.device}</span>
            </span>
          ) : null}
          {parsed.price ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {parsed.price}
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarIcon />
          Submitted: {submitted}
        </p>
      </div>
    </>
  );

  return (
    <article
      className={`relative rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 ${
        item.is_read ? '' : 'shadow-[0_1px_0_rgba(15,23,42,0.02)]'
      }`}
    >
      {!item.is_read ? (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-indigo-500" />
      ) : null}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        {href ? (
          <Link to={href} className="flex min-w-0 flex-1 gap-3 rounded-xl outline-none hover:opacity-95 focus-visible:ring-2 focus-visible:ring-indigo-200">
            {body}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 gap-3">{body}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {href ? (
            <Link
              to={href}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open listing · #{listingId}
              <ExternalIcon />
            </Link>
          ) : null}
          {!item.is_read ? (
            <button
              type="button"
              onClick={onMarkRead}
              disabled={marking}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              Mark read
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-500 hover:bg-white hover:text-slate-800'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span
          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
            active ? 'bg-white/15 text-white' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function StatusPill({
  kind,
  label,
}: {
  kind: ReturnType<typeof notificationStatus>['kind'];
  label: string;
}) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700',
    moderation: 'bg-sky-50 text-sky-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    neutral: 'bg-slate-100 text-slate-600',
  } as const;
  const dots = {
    pending: 'bg-amber-500',
    moderation: 'bg-sky-500',
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    neutral: 'bg-slate-400',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${styles[kind]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[kind]}`} />
      {label}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 1.5 5H4.5S6 12.5 6 9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 12h10M11 9l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9" cy="8" r="2.2" fill="currentColor" />
      <circle cx="15" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 18h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 7V4h6v3M9 17v3h6v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 16 16 8M10 8h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
