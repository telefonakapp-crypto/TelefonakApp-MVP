import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogDetail, fetchAuditLogs } from '../../services/auditService';
import type { AuditLogItem } from '../../types/audit';

type FiltersState = {
  search: string;
  action: string;
  entity_type: string;
  admin: string;
  date_from: string;
  date_to: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  action: '',
  entity_type: '',
  admin: '',
  date_from: '',
  date_to: '',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function actionLabel(action: string) {
  if (action === 'DECLINE_APPROVED_LISTING') {
    return 'Decline approved listing';
  }
  return action.replace(/\./g, ' · ');
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const limit = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setFilters((prev) => ({ ...prev, search: searchInput }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleFilterChange = useCallback((next: Partial<FiltersState>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleClear = useCallback(() => {
    setPage(1);
    setSearchInput('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: filters.search.trim() || undefined,
      action: filters.action || undefined,
      entity_type: filters.entity_type || undefined,
      admin: filters.admin || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }),
    [page, filters]
  );

  const logsQuery = useQuery({
    queryKey: ['admin-audit-logs', queryParams],
    queryFn: () => fetchAuditLogs(queryParams),
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-audit-log', selectedId],
    queryFn: () => fetchAuditLogDetail(selectedId as number),
    enabled: selectedId != null,
  });

  const items = logsQuery.data?.items ?? [];
  const pagination = logsQuery.data?.pagination;
  const filterOptions = logsQuery.data?.filters;
  const hasFilters = Boolean(
    filters.search ||
      filters.action ||
      filters.entity_type ||
      filters.admin ||
      filters.date_from ||
      filters.date_to
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Audit Logs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Read-only history of Admin Web actions
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Search</label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Action, admin, IP, metadata…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Admin</label>
            <select
              value={filters.admin}
              onChange={(e) => handleFilterChange({ admin: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">All admins</option>
              {(filterOptions?.admins || []).map((admin) => (
                <option key={admin.id} value={String(admin.id)}>
                  {admin.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Action</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange({ action: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">All actions</option>
              {(filterOptions?.actions || []).map((action) => (
                <option key={action} value={action}>
                  {actionLabel(action)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Entity</label>
            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange({ entity_type: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">All entities</option>
              {(filterOptions?.entityTypes || []).map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange({ date_from: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange({ date_to: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>
        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>

      {logsQuery.isLoading ? <AuditTableSkeleton /> : null}

      {logsQuery.isError ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Unable to load audit logs</h3>
            <button
              type="button"
              onClick={() => logsQuery.refetch()}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!logsQuery.isLoading && !logsQuery.isError ? (
        <>
          <AuditTable items={items} onView={setSelectedId} />
          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} events
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || logsQuery.isFetching}
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
                    logsQuery.isFetching
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

      <AuditDetailDrawer
        open={selectedId != null}
        log={detailQuery.data || null}
        loading={detailQuery.isLoading}
        error={detailQuery.isError}
        onRetry={() => detailQuery.refetch()}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function AuditTable({
  items,
  onView,
}: {
  items: AuditLogItem[];
  onView: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No audit events found</p>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting filters or perform an admin action.
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
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Entity ID</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(item.created_at)}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {item.admin?.full_name || '—'}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {actionLabel(item.action)}
                </td>
                <td className="px-4 py-3 text-slate-700">{item.entity_type || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{item.entity_id || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{item.ip_address || '—'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(item.id)}
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

function AuditTableSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-4 flex-1 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function AuditDetailDrawer({
  open,
  log,
  loading,
  error,
  onRetry,
  onClose,
}: {
  open: boolean;
  log: AuditLogItem | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Audit event</h2>
            {log ? (
              <p className="text-sm text-slate-500">{actionLabel(log.action)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-40 rounded bg-slate-200" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-900">Unable to load event</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          ) : null}

          {log ? (
            <div className="space-y-4 text-sm">
              <DetailRow label="Timestamp" value={formatDate(log.created_at)} />
              <DetailRow label="Admin" value={log.admin?.full_name || '—'} />
              <DetailRow label="Action" value={actionLabel(log.action)} />
              <DetailRow label="Entity" value={log.entity_type || '—'} />
              <DetailRow label="Entity ID" value={log.entity_id || '—'} />
              <DetailRow label="IP Address" value={log.ip_address || '—'} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  User Agent
                </p>
                <p className="mt-1 break-all text-slate-700">{log.user_agent || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Metadata
                </p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                  {JSON.stringify(log.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-900">{value}</p>
    </div>
  );
}
