import { useEffect, useState } from 'react';
import { ADMIN_ROLE_OPTIONS } from '../../types/admin';

type AdminsFiltersProps = {
  search: string;
  role: string;
  status: string;
  onChange: (next: { search?: string; role?: string; status?: string }) => void;
  onClear: () => void;
};

export function AdminsFilters({
  search,
  role,
  status,
  onChange,
  onClear,
}: AdminsFiltersProps) {
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

  const hasFilters = Boolean(search || role || status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="admins-search" className="mb-1.5 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="admins-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name or email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label htmlFor="admins-role" className="mb-1.5 block text-xs font-medium text-slate-500">
            Role
          </label>
          <select
            id="admins-role"
            value={role}
            onChange={(e) => onChange({ role: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">All roles</option>
            {ADMIN_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="admins-status" className="mb-1.5 block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="admins-status"
            value={status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
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
