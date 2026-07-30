import { useEffect, useState } from 'react';

type UsersFiltersProps = {
  search: string;
  status: string;
  sort: string;
  onChange: (next: { search?: string; status?: string; sort?: string }) => void;
  onClear: () => void;
};

export function UsersFilters({
  search,
  status,
  sort,
  onChange,
  onClear,
}: UsersFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== search) onChange({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, onChange]);

  const hasFilters = Boolean(search || status || (sort && sort !== 'newest'));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="users-search" className="mb-1.5 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="users-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name or phone"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label htmlFor="users-status" className="mb-1.5 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="users-status"
            value={status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div>
          <label htmlFor="users-sort" className="mb-1.5 block text-xs font-medium text-slate-500">
            Sort
          </label>
          <select
            id="users-sort"
            value={sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most_listings">Most listings</option>
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
