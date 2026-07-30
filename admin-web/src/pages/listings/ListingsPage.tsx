import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchListingBrands, fetchListings } from '../../services/listingsService';
import { ListingsFilters } from '../../components/listings/ListingsFilters';
import {
  ListingsTable,
  ListingsTableSkeleton,
} from '../../components/listings/ListingsTable';
import { ListingDetailDrawer } from '../../components/listings/ListingDetailDrawer';

type FiltersState = {
  search: string;
  status: string;
  brand: string;
  seller: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  status: '',
  brand: '',
  seller: '',
};

export function ListingsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const limit = 20;

  const handleFilterChange = useCallback((next: Partial<FiltersState>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }, []);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      brand: filters.brand || undefined,
      seller: filters.seller.trim() || undefined,
    }),
    [page, filters]
  );

  const brandsQuery = useQuery({
    queryKey: ['admin-listing-brands'],
    queryFn: fetchListingBrands,
    staleTime: 5 * 60 * 1000,
  });

  const listingsQuery = useQuery({
    queryKey: ['admin-listings', queryParams],
    queryFn: () => fetchListings(queryParams),
    placeholderData: (previous) => previous,
  });

  const pagination = listingsQuery.data?.pagination;
  const items = listingsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Listings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review and moderate marketplace listings
        </p>
      </div>

      <ListingsFilters
        search={filters.search}
        status={filters.status}
        brand={filters.brand}
        seller={filters.seller}
        brands={brandsQuery.data ?? []}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {listingsQuery.isLoading ? <ListingsTableSkeleton /> : null}

      {listingsQuery.isError ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Unable to load listings</h3>
            <p className="mt-2 text-sm text-slate-500">
              Something went wrong while fetching listings. Please try again.
            </p>
            <button
              type="button"
              onClick={() => listingsQuery.refetch()}
              disabled={listingsQuery.isFetching}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {listingsQuery.isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      ) : null}

      {!listingsQuery.isLoading && !listingsQuery.isError ? (
        <>
          <ListingsTable items={items} onView={setSelectedId} />

          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} listings
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || listingsQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={
                    !pagination.totalPages ||
                    page >= pagination.totalPages ||
                    listingsQuery.isFetching
                  }
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <ListingDetailDrawer listingId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
