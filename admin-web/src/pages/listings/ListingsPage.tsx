import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchListingBrands, fetchListings } from '../../services/listingsService';
import { ListingsFilters } from '../../components/listings/ListingsFilters';
import {
  ListingsTable,
  ListingsTableSkeleton,
} from '../../components/listings/ListingsTable';
import { ListingDetailDrawer } from '../../components/listings/ListingDetailDrawer';
import { NumberedPagination } from '../../components/pagination/NumberedPagination';

type FiltersState = {
  search: string;
  status: string;
  brand: string;
  seller: string;
  sellerId: string;
  saleType: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  status: '',
  brand: '',
  seller: '',
  sellerId: '',
  saleType: '',
};

function isValidSellerIdInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[1-9]\d*$/.test(trimmed);
}

function parseListingIdParam(raw: string | null) {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const listingIdFromUrl = parseListingIdParam(searchParams.get('listingId'));
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>({
    ...DEFAULT_FILTERS,
    status: statusFromUrl,
  });
  const [selectedId, setSelectedId] = useState<number | null>(listingIdFromUrl);
  const limit = 20;

  useEffect(() => {
    setFilters((prev) =>
      prev.status === statusFromUrl ? prev : { ...prev, status: statusFromUrl }
    );
    setPage(1);
  }, [statusFromUrl]);

  useEffect(() => {
    setSelectedId(listingIdFromUrl);
  }, [listingIdFromUrl]);

  const openListing = useCallback(
    (id: number) => {
      setSelectedId(id);
      const params = new URLSearchParams(searchParams);
      params.set('listingId', String(id));
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const closeListing = useCallback(() => {
    setSelectedId(null);
    if (!searchParams.has('listingId')) return;
    const params = new URLSearchParams(searchParams);
    params.delete('listingId');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleFilterChange = useCallback((next: Partial<FiltersState>) => {
    setPage(1);
    setFilters((prev) => {
      const merged = { ...prev, ...next };
      if (next.status !== undefined) {
        const params = new URLSearchParams(searchParams);
        if (merged.status) params.set('status', merged.status);
        else params.delete('status');
        setSearchParams(params, { replace: true });
      }
      return merged;
    });
  }, [searchParams, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
    const params = new URLSearchParams(searchParams);
    params.delete('status');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const sellerIdTrimmed = filters.sellerId.trim();
  const sellerIdInvalid = !isValidSellerIdInput(sellerIdTrimmed);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      brand: filters.brand || undefined,
      seller: filters.seller.trim() || undefined,
      seller_id: !sellerIdInvalid && sellerIdTrimmed ? sellerIdTrimmed : undefined,
      sale_type: filters.saleType || undefined,
    }),
    [page, filters, sellerIdInvalid, sellerIdTrimmed]
  );

  const brandsQuery = useQuery({
    queryKey: ['admin-listing-brands'],
    queryFn: fetchListingBrands,
    staleTime: 5 * 60 * 1000,
  });

  const listingsQuery = useQuery({
    queryKey: ['admin-listings', queryParams],
    queryFn: () => fetchListings(queryParams),
    enabled: !sellerIdInvalid,
    // Always refetch on mount/filter change so All statuses never keeps a
    // stale page after moderation (refetchOnWindowFocus is off globally).
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const pagination = listingsQuery.data?.pagination;
  const items = listingsQuery.data?.items ?? [];
  const declinedInView = items.filter((item) => item.status === 'declined').length;

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
        sellerId={filters.sellerId}
        saleType={filters.saleType}
        brands={brandsQuery.data ?? []}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {sellerIdInvalid ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">Invalid Seller ID</p>
          <p className="mt-1 text-sm text-slate-500">
            Enter a positive whole number, or leave Seller ID empty.
          </p>
        </div>
      ) : null}

      {!sellerIdInvalid && listingsQuery.isLoading ? <ListingsTableSkeleton /> : null}

      {!sellerIdInvalid && listingsQuery.isError ? (
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

      {!sellerIdInvalid && !listingsQuery.isLoading && !listingsQuery.isError ? (
        <>
          <p className="text-xs text-slate-500">
            Showing {items.length} on this page
            {declinedInView > 0 ? ` · ${declinedInView} declined` : ''}
            {pagination ? ` · ${pagination.totalItems} total` : ''}
          </p>
          <ListingsTable items={items} onView={openListing} />

          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} listings
              </p>
              <NumberedPagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                disabled={listingsQuery.isFetching}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <ListingDetailDrawer
        listingId={selectedId}
        onClose={closeListing}
        onSelectListing={openListing}
      />
    </div>
  );
}
