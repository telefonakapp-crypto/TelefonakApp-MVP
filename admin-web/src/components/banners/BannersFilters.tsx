import { useEffect, useState } from 'react';

type BannersFiltersProps = {
  search: string;
  status: string;
  onChange: (next: { search?: string; status?: string }) => void;
  onClear: () => void;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'disabled', label: 'Disabled' },
];

export function BannersFilters({
  search,
  status,
  onChange,
  onClear,
}: BannersFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) {
        onChange({ search: searchInput });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, onChange]);

  const hasFilters = Boolean(search || status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label htmlFor="banners-search" className="mb-1.5 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="banners-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Title, subtitle, or CTA"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label htmlFor="banners-status" className="mb-1.5 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="banners-status"
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
