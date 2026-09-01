import { ListingStatusBadge } from './ListingStatusBadge';
import type { AdminListingListItem } from '../../types/listing';

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

type ListingsTableProps = {
  items: AdminListingListItem[];
  onView: (id: number) => void;
};

export function ListingsTable({ items, onView }: ListingsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No listings found</p>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Moderated At</th>
              <th className="px-4 py-3">Moderated By</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((listing) => (
              <tr key={listing.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{listing.brand_name}</td>
                <td className="px-4 py-3 text-slate-700">{listing.model_name}</td>
                <td className="px-4 py-3 text-slate-700">{formatPrice(listing.price)}</td>
                <td className="px-4 py-3 text-slate-700">{listing.seller_name}</td>
                <td className="px-4 py-3">
                  <ListingStatusBadge status={listing.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(listing.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {listing.approved_or_rejected_at
                    ? formatDate(listing.approved_or_rejected_at)
                    : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {listing.moderated_by || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(listing.id)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
  );
}

export function ListingsTableSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <div className="h-12 w-12 rounded-lg bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
