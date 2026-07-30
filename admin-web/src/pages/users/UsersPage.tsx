import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '../../services/userService';
import { UsersFilters } from '../../components/users/UsersFilters';
import {
  UsersTable,
  UsersTableSkeleton,
} from '../../components/users/UsersTable';
import { UserDetailDrawer } from '../../components/users/UserDetailDrawer';

type FiltersState = {
  search: string;
  status: string;
  sort: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  status: '',
  sort: 'newest',
};

export function UsersPage() {
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
      sort: filters.sort || 'newest',
    }),
    [page, filters]
  );

  const usersQuery = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: () => fetchUsers(queryParams),
    placeholderData: (previous) => previous,
  });

  const pagination = usersQuery.data?.pagination;
  const items = usersQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Users</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage marketplace customer accounts
        </p>
      </div>

      <UsersFilters
        search={filters.search}
        status={filters.status}
        sort={filters.sort}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {usersQuery.isLoading ? <UsersTableSkeleton /> : null}

      {usersQuery.isError ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Unable to load users</h3>
            <p className="mt-2 text-sm text-slate-500">
              Something went wrong while fetching users. Please try again.
            </p>
            <button
              type="button"
              onClick={() => usersQuery.refetch()}
              disabled={usersQuery.isFetching}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {usersQuery.isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError ? (
        <>
          <UsersTable items={items} onView={setSelectedId} />

          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} users
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || usersQuery.isFetching}
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
                    usersQuery.isFetching
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

      <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
