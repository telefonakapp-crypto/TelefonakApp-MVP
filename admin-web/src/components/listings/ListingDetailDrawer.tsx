import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveListing,
  declineListing,
  deleteListing,
  fetchListingDetail,
} from '../../services/listingsService';
import { ListingStatusBadge } from './ListingStatusBadge';
import { ConfirmModal } from './ConfirmModal';
import { getListingDisplayName } from '../../utils/listingDisplayName';
import type { AdminListingAuction } from '../../types/listing';
import {
  auctionStatusLabel,
  completionSourceLabel,
  formatAdminDateTime,
  formatAdminMoney,
  saleTypeLabel,
} from '../../utils/auctionDisplay';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';

function formatPrice(price: number | string) {
  const value = typeof price === 'number' ? price : Number(price);
  if (Number.isNaN(value)) return String(price);
  return `${value.toLocaleString()} JOD`;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

type ListingDetailDrawerProps = {
  listingId: number | null;
  onClose: () => void;
  onSelectListing?: (id: number) => void;
};

export function ListingDetailDrawer({
  listingId,
  onClose,
  onSelectListing,
}: ListingDetailDrawerProps) {
  const open = listingId != null;
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canModerateListings = hasPermission(PERMISSIONS.LISTINGS_MODERATE);
  const [activeImage, setActiveImage] = useState(0);
  const [confirmAction, setConfirmAction] = useState<
    'approve' | 'decline' | 'delete' | null
  >(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-listing', listingId],
    queryFn: () => fetchListingDetail(listingId as number),
    enabled: open,
  });

  useEffect(() => {
    setActiveImage(0);
    setConfirmAction(null);
    setDeclineReason('');
    setActionError(null);
  }, [listingId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmAction) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmAction, onClose]);

  const invalidateAfterModeration = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-listing', listingId] }),
    ]);
    // Force the list to refetch after approve/decline so the row's new
    // status is visible without a stale page.
    await queryClient.refetchQueries({ queryKey: ['admin-listings'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveListing(listingId as number),
    onSuccess: async () => {
      setConfirmAction(null);
      await invalidateAfterModeration();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to approve listing';
      setActionError(message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineListing(listingId as number, declineReason.trim()),
    onSuccess: async () => {
      setConfirmAction(null);
      setDeclineReason('');
      await invalidateAfterModeration();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to decline listing';
      setActionError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteListing(listingId as number),
    onSuccess: async () => {
      setConfirmAction(null);
      await invalidateAfterModeration();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete listing';
      setActionError(message);
    },
  });

  if (!open) return null;

  const listing = data?.listing;
  const images = data?.images ?? [];
  const status = String(listing?.status ?? '')
    .trim()
    .toLowerCase();

  // Action matrix (single source of truth for the footer):
  // pending/resubmitted/updated → Approve + Decline + Delete
  // approved            → Decline + Delete
  // declined/deleted    → none
  const canApprove =
    status === 'pending' || status === 'resubmitted' || status === 'updated';
  const canDecline =
    status === 'pending' ||
    status === 'resubmitted' ||
    status === 'updated' ||
    status === 'approved';
  const canDelete =
    status === 'pending' ||
    status === 'resubmitted' ||
    status === 'updated' ||
    status === 'approved';
  const showModerationActions =
    canModerateListings && Boolean(listing) && (canApprove || canDecline || canDelete);
  const actionLoading =
    approveMutation.isPending || declineMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <button
          type="button"
          aria-label="Close drawer"
          className="absolute inset-0 bg-slate-900/40"
          onClick={onClose}
        />
        <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-xl md:max-w-lg">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Listing details</h2>
              {listing ? (
                <p className="text-sm text-slate-500">
                  {getListingDisplayName(listing.brand_name, listing.model_name)}
                  {listing.revision_number != null && listing.revision_number > 1
                    ? ` · Revision ${listing.revision_number}`
                    : listing.revision_number === 1 &&
                        (listing.revision_history?.length ?? 0) > 1
                      ? ' · Revision 1'
                      : ''}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="aspect-[4/3] rounded-xl bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-24 rounded bg-slate-200" />
              </div>
            ) : null}

            {isError ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-900">Unable to load listing</p>
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

            {listing ? (
              <div className="space-y-5">
                <div>
                  {images.length > 0 ? (
                    <>
                      <img
                        src={images[activeImage]?.image_url}
                        alt=""
                        className="aspect-[4/3] w-full rounded-xl object-cover"
                      />
                      {images.length > 1 ? (
                        <div className="mt-3 flex gap-2 overflow-x-auto">
                          {images.map((image, index) => (
                            <button
                              key={image.id}
                              type="button"
                              onClick={() => setActiveImage(index)}
                              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                                index === activeImage
                                  ? 'border-slate-900'
                                  : 'border-transparent'
                              }`}
                            >
                              <img
                                src={image.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                      No images
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <ListingStatusBadge status={listing.status} />
                    <p className="text-sm text-slate-500">{formatDate(listing.created_at)}</p>
                  </div>
                  {listing.status === 'approved' && listing.approved_or_rejected_at ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">Approved by:</span>{' '}
                        {listing.moderated_by || '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Approved at:</span>{' '}
                        {formatDate(listing.approved_or_rejected_at)}
                      </p>
                    </div>
                  ) : null}
                  {listing.status === 'declined' && listing.approved_or_rejected_at ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">Rejected by:</span>{' '}
                        {listing.moderated_by || '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Rejected at:</span>{' '}
                        {formatDate(listing.approved_or_rejected_at)}
                      </p>
                    </div>
                  ) : null}
                  {listing.previous_listing ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-700">
                      <p className="font-semibold text-sky-900">
                        {listing.previous_listing.status === 'declined'
                          ? 'Previously Rejected'
                          : 'Previous revision'}
                      </p>
                      <p className="mt-2">
                        <span className="font-medium text-slate-900">Previous Listing ID:</span>{' '}
                        {onSelectListing ? (
                          <button
                            type="button"
                            onClick={() => onSelectListing(listing.previous_listing!.id)}
                            className="font-medium text-sky-800 underline-offset-2 hover:underline"
                          >
                            #{listing.previous_listing.id}
                          </button>
                        ) : (
                          <>#{listing.previous_listing.id}</>
                        )}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Previous Status:</span>{' '}
                        {listing.previous_listing.status || '—'}
                      </p>
                      {'price' in listing.previous_listing && listing.previous_listing.price != null ? (
                        <p className="mt-1">
                          <span className="font-medium text-slate-900">Previous Price:</span>{' '}
                          {formatPrice(listing.previous_listing.price as number | string)}
                        </p>
                      ) : null}
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Previous Rejection Reason:</span>{' '}
                        {listing.previous_listing.decline_reason?.trim() || '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Previous Moderator:</span>{' '}
                        {listing.previous_listing.moderated_by || '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Previous Rejection Time:</span>{' '}
                        {listing.previous_listing.approved_or_rejected_at
                          ? formatDate(listing.previous_listing.approved_or_rejected_at)
                          : '—'}
                      </p>
                    </div>
                  ) : null}

                  {listing.revision_number != null || listing.root_listing_id != null ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">Revision Number:</span>{' '}
                        {listing.revision_number ?? 1}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-slate-900">Root Listing ID:</span>{' '}
                        {listing.root_listing_id ?? listing.id}
                      </p>
                      {listing.previous_listing_id ? (
                        <p className="mt-1">
                          <span className="font-medium text-slate-900">Previous Listing ID:</span>{' '}
                          {onSelectListing ? (
                            <button
                              type="button"
                              onClick={() => onSelectListing(listing.previous_listing_id as number)}
                              className="font-medium text-sky-800 underline-offset-2 hover:underline"
                            >
                              #{listing.previous_listing_id}
                            </button>
                          ) : (
                            <>#{listing.previous_listing_id}</>
                          )}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {(listing.revision_history?.length ?? 0) > 1 ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Revision History
                      </p>
                      <ul className="mt-3 space-y-3">
                        {listing.revision_history!.map((revision, index) => {
                          const isOpen = revision.id === listing.id;
                          return (
                            <li key={revision.id}>
                              {index > 0 ? (
                                <div className="mb-3 flex justify-center text-slate-300" aria-hidden>
                                  ↓
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isOpen && onSelectListing) {
                                    onSelectListing(revision.id);
                                  }
                                }}
                                disabled={isOpen || !onSelectListing}
                                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                  isOpen
                                    ? 'border-slate-900 bg-slate-50'
                                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                } disabled:cursor-default`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-900">
                                    Revision {revision.revision_number}
                                    {revision.is_current ? ' (Current)' : ''}
                                    {' · '}#{revision.id}
                                  </p>
                                  <ListingStatusBadge status={revision.status} />
                                </div>
                                {revision.is_historical_snapshot || !revision.is_current ? (
                                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Historical snapshot
                                  </p>
                                ) : null}
                                <p className="mt-2 text-slate-600">
                                  <span className="font-medium text-slate-900">Created:</span>{' '}
                                  {formatDate(revision.created_at)}
                                </p>
                                {revision.price != null ? (
                                  <p className="mt-1 text-slate-600">
                                    <span className="font-medium text-slate-900">Price:</span>{' '}
                                    {formatPrice(revision.price)}
                                  </p>
                                ) : null}
                                {revision.status === 'declined' ? (
                                  <>
                                    <p className="mt-1 text-slate-600">
                                      <span className="font-medium text-slate-900">Rejected by:</span>{' '}
                                      {revision.moderated_by || '—'}
                                    </p>
                                    <p className="mt-1 text-slate-600">
                                      <span className="font-medium text-slate-900">Rejected on:</span>{' '}
                                      {revision.approved_or_rejected_at
                                        ? formatDate(revision.approved_or_rejected_at)
                                        : '—'}
                                    </p>
                                    <p className="mt-1 text-slate-600">
                                      <span className="font-medium text-slate-900">Reason:</span>{' '}
                                      {revision.decline_reason?.trim() || '—'}
                                    </p>
                                  </>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {listing.category_slug === 'smartwatches' ? (
                    <>
                      <DetailField label="Brand" value={listing.brand_name} />
                      <DetailField label="Model" value={listing.model_name} />
                      {listing.case_size_label ? (
                        <DetailField label="Case Size" value={listing.case_size_label} />
                      ) : null}
                      {listing.watch_connectivity_name ? (
                        <DetailField
                          label="Connectivity"
                          value={listing.watch_connectivity_name}
                        />
                      ) : null}
                      {listing.storage_display ? (
                        <DetailField label="Storage" value={listing.storage_display} />
                      ) : listing.capacity_gb != null ? (
                        <DetailField label="Storage" value={`${listing.capacity_gb} GB`} />
                      ) : null}
                      {listing.color_display_name || listing.color_name ? (
                        <DetailField
                          label="Color / Finish"
                          value={listing.color_display_name || listing.color_name || '—'}
                        />
                      ) : null}
                      {listing.battery_percentage != null ? (
                        <DetailField
                          label="Battery"
                          value={`${listing.battery_percentage}%`}
                        />
                      ) : null}
                      <DetailField label="Condition" value={listing.condition_name || '—'} />
                      <DetailField label="Price" value={formatPrice(listing.price)} />
                      <DetailField label="Location" value={listing.location || '—'} />
                    </>
                  ) : (
                    <>
                      <DetailField label="Brand" value={listing.brand_name} />
                      <DetailField label="Model" value={listing.model_name} />
                      <DetailField label="Storage" value={listing.storage_display || (listing.capacity_gb != null ? `${listing.capacity_gb} GB` : '—')} />
                      <DetailField label="Color" value={listing.color_name || '—'} />
                      <DetailField
                        label="Battery"
                        value={
                          listing.battery_percentage != null
                            ? `${listing.battery_percentage}%`
                            : '—'
                        }
                      />
                      <DetailField label="Condition" value={listing.condition_name || '—'} />
                      <DetailField label="Price" value={formatPrice(listing.price)} />
                      <DetailField label="Location" value={listing.location || '—'} />
                    </>
                  )}
                </dl>

                {listing.sale_type === 'bid' ? (
                  <AuctionDetails auction={listing.auction} />
                ) : null}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {listing.description || 'No description provided.'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Seller
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {listing.seller.full_name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{listing.seller.phone_number}</p>
                </div>

                {listing.status === 'declined' && listing.decline_reason ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-700">
                      Decline reason
                    </p>
                    <p className="mt-1 text-sm text-red-800">{listing.decline_reason}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {showModerationActions ? (
            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-4">
              <div className="flex gap-2">
                {canApprove ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setConfirmAction('approve');
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                ) : null}
                {canDecline ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setDeclineReason('');
                      setConfirmAction('decline');
                    }}
                    className={`rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 ${
                      canApprove || canDelete ? 'flex-1' : 'w-full'
                    }`}
                  >
                    {status === 'approved' ? 'Decline Listing' : 'Decline'}
                  </button>
                ) : null}
              </div>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmAction('delete');
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Delete Listing
                </button>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      <ConfirmModal
        open={confirmAction === 'approve'}
        title="Approve listing?"
        description="This listing will become visible in the marketplace."
        confirmLabel="Approve"
        loading={actionLoading}
        error={actionError}
        onCancel={() => {
          if (!actionLoading) setConfirmAction(null);
        }}
        onConfirm={() => approveMutation.mutate()}
      />

      <ConfirmModal
        open={confirmAction === 'decline'}
        title={
          status === 'approved' ? 'Decline approved listing?' : 'Decline listing?'
        }
        description={
          status === 'approved'
            ? 'This listing will be removed from the marketplace immediately. The seller will be notified. A decline reason is required.'
            : 'The seller will be notified. A decline reason is required.'
        }
        confirmLabel={status === 'approved' ? 'Decline Listing' : 'Decline'}
        confirmTone="danger"
        loading={actionLoading}
        error={actionError}
        onCancel={() => {
          if (!actionLoading) setConfirmAction(null);
        }}
        onConfirm={() => {
          if (!declineReason.trim()) {
            setActionError('Please provide a decline reason.');
            return;
          }
          setActionError(null);
          declineMutation.mutate();
        }}
      >
        <label htmlFor="decline-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
          Reason
        </label>
        <textarea
          id="decline-reason"
          rows={3}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Explain why this listing is being declined"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </ConfirmModal>

      <ConfirmModal
        open={confirmAction === 'delete'}
        title="Delete listing?"
        description="This listing will be permanently removed from the marketplace and marked as deleted. This cannot be undone from Admin."
        confirmLabel="Delete Listing"
        confirmTone="danger"
        loading={actionLoading}
        error={actionError}
        onCancel={() => {
          if (!actionLoading) setConfirmAction(null);
        }}
        onConfirm={() => {
          setActionError(null);
          deleteMutation.mutate();
        }}
      />
    </>
  );
}

function AuctionDetails({ auction }: { auction: AdminListingAuction | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Auction</p>
      {!auction ? (
        <p className="mt-2 text-sm text-slate-600">Auction details are unavailable.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label="Sale type" value={saleTypeLabel('bid')} />
          <DetailField label="Auction status" value={auctionStatusLabel(auction.auction_status)} />
          <DetailField label="Starting price" value={formatAdminMoney(auction.starting_price) || '—'} />
          <DetailField
            label="Current highest bid"
            value={formatAdminMoney(auction.current_highest_bid) || 'No bids yet'}
          />
          {auction.auction_status === 'live' ? (
            <DetailField
              label="Minimum next bid"
              value={formatAdminMoney(auction.minimum_next_bid) || '—'}
            />
          ) : null}
          {auction.auction_status === 'live' ? (
            <DetailField label="Maximum bid" value={formatAdminMoney(auction.maximum_bid) || '—'} />
          ) : null}
          <DetailField label="Total bids" value={String(auction.bid_count)} />
          <DetailField
            label="Duration"
            value={auction.duration_hours != null ? `${auction.duration_hours} hours` : '—'}
          />
          <DetailField label="Start time" value={formatAdminDateTime(auction.starts_at)} />
          <DetailField label="Original end time" value={formatAdminDateTime(auction.original_ends_at)} />
          <DetailField label="Current end time" value={formatAdminDateTime(auction.ends_at)} />
          <DetailField label="Extension used" value={auction.extension_used ? 'Yes' : 'No'} />
          {auction.winning_bid_id != null ? (
            <DetailField
              label="Winning bid"
              value={
                auction.winning_bid_amount
                  ? `${formatAdminMoney(auction.winning_bid_amount)} · #${auction.winning_bid_id}`
                  : `#${auction.winning_bid_id}`
              }
            />
          ) : null}
          {completionSourceLabel(auction.completion_source) ? (
            <DetailField
              label="Completion source"
              value={completionSourceLabel(auction.completion_source) || '—'}
            />
          ) : null}
        </dl>
      )}
    </div>
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
