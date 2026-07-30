import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveListing,
  declineListing,
  fetchListingDetail,
} from '../../services/listingsService';
import { ListingStatusBadge } from './ListingStatusBadge';
import { ConfirmModal } from './ConfirmModal';

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
};

export function ListingDetailDrawer({ listingId, onClose }: ListingDetailDrawerProps) {
  const open = listingId != null;
  const queryClient = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'decline' | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ['admin-listing', listingId] }),
    ]);
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

  if (!open) return null;

  const listing = data?.listing;
  const images = data?.images ?? [];
  const isPending = listing?.status === 'pending';
  const actionLoading = approveMutation.isPending || declineMutation.isPending;

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
              <h2 className="text-lg font-semibold text-slate-900">Listing details</h2>
              {listing ? (
                <p className="text-sm text-slate-500">
                  {listing.brand_name} {listing.model_name}
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

          <div className="flex-1 overflow-y-auto p-4">
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

                <div className="flex items-center justify-between gap-3">
                  <ListingStatusBadge status={listing.status} />
                  <p className="text-sm text-slate-500">{formatDate(listing.created_at)}</p>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <DetailField label="Brand" value={listing.brand_name} />
                  <DetailField label="Model" value={listing.model_name} />
                  <DetailField label="Storage" value={listing.capacity_gb != null ? `${listing.capacity_gb} GB` : '—'} />
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
                </dl>

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

          {isPending && listing ? (
            <div className="flex gap-2 border-t border-slate-200 p-4">
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
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setDeclineReason('');
                  setConfirmAction('decline');
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Decline
              </button>
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
        title="Decline listing?"
        description="The seller will be notified. A decline reason is required."
        confirmLabel="Decline"
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
