import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchModerationHistory } from '../../services/moderationHistoryService';
import type { ModerationHistoryType } from '../../services/moderationHistoryService';
import { ListingStatusBadge } from '../../components/listings/ListingStatusBadge';
import { ListingDetailDrawer } from '../../components/listings/ListingDetailDrawer';
import { NumberedPagination } from '../../components/pagination/NumberedPagination';

function formatPrice(price: number | string | null | undefined) {
  if (price == null || price === '') return '—';
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

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map((part) => parseInt(part, 10));
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function ModerationHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type: ModerationHistoryType =
    searchParams.get('type') === 'updated' ? 'updated' : 'resubmitted';
  const month = /^\d{4}-\d{2}$/.test(searchParams.get('month') || '')
    ? (searchParams.get('month') as string)
    : currentMonth();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const limit = 20;

  const queryParams = useMemo(
    () => ({ type, month, page, limit }),
    [type, month, page]
  );

  const historyQuery = useQuery({
    queryKey: ['admin-moderation-history', queryParams],
    queryFn: () => fetchModerationHistory(queryParams),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const items = historyQuery.data?.items ?? [];
  const pagination = historyQuery.data?.pagination;
  const title = type === 'updated' ? 'Updates' : 'Resubmissions';

  const setType = (next: 'resubmitted' | 'updated') => {
    setPage(1);
    setSearchParams({ type: next, month });
  };

  const setMonth = (next: string) => {
    setPage(1);
    setSearchParams({ type, month: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Moderation History</h2>
        <p className="mt-1 text-sm text-slate-500">
          Historical {title.toLowerCase()} for {month}. Current listing status does not remove these events.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label htmlFor="history-type" className="mb-1.5 block text-xs font-medium text-slate-500">
              Event type
            </label>
            <select
              id="history-type"
              value={type}
              onChange={(e) => setType(e.target.value === 'updated' ? 'updated' : 'resubmitted')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            >
              <option value="resubmitted">Resubmitted</option>
              <option value="updated">Updated</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Previous month
            </button>
            <p className="min-w-[7rem] text-center text-sm font-medium text-slate-900">{month}</p>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Next month
            </button>
          </div>
        </div>
      </div>

      {historyQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Loading history…
        </div>
      ) : null}

      {historyQuery.isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Unable to load history</h3>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!historyQuery.isLoading && !historyQuery.isError ? (
        <>
          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-900">No {title.toLowerCase()} this month</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Listing</th>
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3">Previous</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Current</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {item.brand_name} {item.model_name}
                          </p>
                          <p className="text-xs text-slate-500">#{item.listing_id}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.seller_name}</td>
                        <td className="px-4 py-3">
                          <ListingStatusBadge status={item.previous_status || '—'} />
                        </td>
                        <td className="px-4 py-3">
                          <ListingStatusBadge status={item.event_type} />
                        </td>
                        <td className="px-4 py-3">
                          <ListingStatusBadge status={item.current_status} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.previous_price != null ? (
                            <span>
                              {formatPrice(item.previous_price)} → {formatPrice(item.event_price)}
                            </span>
                          ) : (
                            formatPrice(item.event_price)
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {formatDate(item.occurred_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.listing_id)}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} events
              </p>
              <NumberedPagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                disabled={historyQuery.isFetching}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <ListingDetailDrawer
        listingId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelectListing={setSelectedId}
      />
    </div>
  );
}
