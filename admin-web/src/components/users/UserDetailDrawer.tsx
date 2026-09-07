import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUserDetail, updateUserStatus } from '../../services/userService';
import { UserStatusBadge } from './UsersTable';
import { ListingStatusBadge } from '../listings/ListingStatusBadge';
import { ConfirmModal } from '../listings/ConfirmModal';
import { getListingDisplayName } from '../../utils/listingDisplayName';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatPrice(price: number | string) {
  const value = typeof price === 'number' ? price : Number(price);
  if (Number.isNaN(value)) return String(price);
  return `${value.toLocaleString()} JOD`;
}

function formatDeactivationReason(reason?: string | null) {
  if (!reason) return '—';
  const labels: Record<string, string> = {
    no_longer_useful: 'No longer finds Telefonak useful',
    sold_phone: 'Sold their phone',
    need_a_break: 'Needs a break',
    not_using_anymore: 'No longer uses Telefonak',
    disabled_by_admin: 'Disabled by admin',
  };
  return labels[reason] || reason;
}

type UserDetailDrawerProps = {
  userId: number | null;
  onClose: () => void;
};

export function UserDetailDrawer({ userId, onClose }: UserDetailDrawerProps) {
  const open = userId != null;
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWriteUsers = hasPermission(PERMISSIONS.USERS_WRITE);
  const [confirmAction, setConfirmAction] = useState<'enable' | 'disable' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => fetchUserDetail(userId as number),
    enabled: open,
  });

  useEffect(() => {
    setConfirmAction(null);
    setActionError(null);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmAction) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmAction, onClose]);

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => updateUserStatus(userId as number, isActive),
    onSuccess: async () => {
      setConfirmAction(null);
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user', userId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update user status';
      setActionError(message);
    },
  });

  if (!open) return null;

  const user = data?.user;
  const listings = data?.listings ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <button
          type="button"
          aria-label="Close drawer"
          className="absolute inset-0 bg-slate-900/40"
          onClick={onClose}
        />
        <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl md:max-w-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">User details</h2>
              {user ? <p className="text-sm text-slate-500">{user.full_name}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-1/2 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-slate-200" />
                  ))}
                </div>
              </div>
            ) : null}

            {isError ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-900">Unable to load user</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isFetching ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            ) : null}

            {user ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <UserStatusBadge active={user.is_active} />
                  <p className="text-sm text-slate-500">Joined {formatDate(user.created_at)}</p>
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <DetailField label="Full Name" value={user.full_name} />
                  <DetailField label="Phone Number" value={user.phone_number} />
                  <DetailField
                    label="Status"
                    value={user.is_active ? 'Active' : 'Disabled'}
                  />
                  {!user.is_active ? (
                    <>
                      <DetailField
                        label="Deactivated At"
                        value={formatDate(user.deactivated_at)}
                      />
                      <DetailField
                        label="Reason for deactivation"
                        value={formatDeactivationReason(user.deactivation_reason)}
                      />
                    </>
                  ) : null}
                </dl>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Listing statistics
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <StatCard label="Total" value={user.total_listings} />
                    <StatCard label="Active" value={user.active_listings} />
                    <StatCard label="Pending" value={user.pending_listings} />
                    <StatCard label="Sold" value={user.sold_listings} />
                    <StatCard label="Declined" value={user.declined_listings} />
                    <StatCard label="Favorites" value={user.favorites_count} />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recent Listings
                  </p>
                  {listings.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      No listings yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {listings.map((listing) => (
                        <li
                          key={listing.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
                        >
                          {listing.thumbnail_image ? (
                            <img
                              src={listing.thumbnail_image}
                              alt=""
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                              N/A
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {getListingDisplayName(listing.brand_name, listing.model_name)}
                            </p>
                            <p className="text-xs text-slate-500">{formatPrice(listing.price)}</p>
                          </div>
                          <ListingStatusBadge status={listing.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {user && canWriteUsers ? (
            <div className="border-t border-slate-200 p-4">
              {user.is_active ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmAction('disable');
                  }}
                  className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Disable User
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmAction('enable');
                  }}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Enable User
                </button>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      <ConfirmModal
        open={confirmAction === 'disable'}
        title="Disable user?"
        description="This user will not be able to log in, create listings, or send offers. Existing data stays intact."
        confirmLabel="Disable"
        confirmTone="danger"
        loading={statusMutation.isPending}
        error={actionError}
        onCancel={() => {
          if (!statusMutation.isPending) setConfirmAction(null);
        }}
        onConfirm={() => statusMutation.mutate(false)}
      />

      <ConfirmModal
        open={confirmAction === 'enable'}
        title="Enable user?"
        description="This user will regain access to the marketplace."
        confirmLabel="Enable"
        loading={statusMutation.isPending}
        error={actionError}
        onCancel={() => {
          if (!statusMutation.isPending) setConfirmAction(null);
        }}
        onConfirm={() => statusMutation.mutate(true)}
      />
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}
