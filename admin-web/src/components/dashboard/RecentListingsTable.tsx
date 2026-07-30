import type { DashboardRecentListing } from '../../types/dashboard';
import { ListingStatusBadge } from '../listings/ListingStatusBadge';

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

type RecentListingsTableProps = {
  listings: DashboardRecentListing[];
};

export function RecentListingsTable({ listings }: RecentListingsTableProps) {
  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        No listings yet.
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
              <th className="px-4 py-3">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listings.map((listing) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentListingsTableSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 h-4 w-40 rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
