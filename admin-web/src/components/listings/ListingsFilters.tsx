import { useEffect, useState } from 'react';

type ListingsFiltersProps = {
  search: string;
  status: string;
  brand: string;
  seller: string;
  brands: Array<{ id: number; name: string }>;
  onChange: (next: {
    search?: string;
    status?: string;
    brand?: string;
    seller?: string;
  }) => void;
  onClear: () => void;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'resubmitted', label: 'Resubmitted' },
  { value: 'updated', label: 'Updated' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'sold', label: 'Sold' },
  { value: 'hidden', label: 'Hidden' },
];

export function ListingsFilters({
  search,
  status,
  brand,
  seller,
  brands,
  onChange,
  onClear,
}: ListingsFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);
  const [sellerInput, setSellerInput] = useState(seller);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setSellerInput(seller);
  }, [seller]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) {
        onChange({ search: searchInput });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, onChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sellerInput !== seller) {
        onChange({ seller: sellerInput });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [sellerInput, seller, onChange]);

  const hasFilters = Boolean(search || status || brand || seller);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label htmlFor="listings-search" className="mb-1.5 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="listings-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Brand or model"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label htmlFor="listings-status" className="mb-1.5 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="listings-status"
            value={status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="listings-brand" className="mb-1.5 block text-xs font-medium text-slate-500">
            Brand
          </label>
          <select
            id="listings-brand"
            value={brand}
            onChange={(e) => onChange({ brand: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            <option value="">All brands</option>
            {brands.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="listings-seller" className="mb-1.5 block text-xs font-medium text-slate-500">
            Seller
          </label>
          <input
            id="listings-seller"
            type="search"
            value={sellerInput}
            onChange={(e) => setSellerInput(e.target.value)}
            placeholder="Name or phone"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
