import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdmin,
  disableAdmin,
  fetchAdmins,
  resetAdminPassword,
  updateAdmin,
} from '../../services/adminService';
import { useAuth } from '../../hooks/useAuth';
import { AdminsFilters } from '../../components/admins/AdminsFilters';
import {
  AdminsTable,
  AdminsTableSkeleton,
} from '../../components/admins/AdminsTable';
import { AdminForm } from '../../components/admins/AdminForm';
import { ResetPasswordModal } from '../../components/admins/ResetPasswordModal';
import { ConfirmModal } from '../../components/listings/ConfirmModal';
import { NumberedPagination } from '../../components/pagination/NumberedPagination';
import type {
  AdminFormValues,
  AdminListItem,
} from '../../types/admin';

type FiltersState = {
  search: string;
  role: string;
  status: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  role: '',
  status: '',
};

function getErrorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    fallback
  );
}

export function AdminsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAdmin, setEditingAdmin] = useState<AdminListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminListItem | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<AdminListItem | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
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
      role: filters.role || undefined,
      status: filters.status || undefined,
    }),
    [page, filters]
  );

  const adminsQuery = useQuery({
    queryKey: ['admin-admins', queryParams],
    queryFn: () => fetchAdmins(queryParams),
    placeholderData: (previous) => previous,
  });

  const invalidateAdmins = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      if (formMode === 'edit' && editingAdmin) {
        return updateAdmin(editingAdmin.id, {
          full_name: values.full_name.trim(),
          email: values.email.trim(),
          role: values.role,
          is_active: values.is_active,
        });
      }
      return createAdmin({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      });
    },
    onSuccess: async () => {
      setFormError(null);
      setFormOpen(false);
      setEditingAdmin(null);
      await invalidateAdmins();
    },
    onError: (err) => setFormError(getErrorMessage(err, 'Failed to save admin')),
  });

  const resetMutation = useMutation({
    mutationFn: (password: string) =>
      resetAdminPassword(resetTarget!.id, password),
    onSuccess: async () => {
      setResetError(null);
      setResetTarget(null);
    },
    onError: (err) => setResetError(getErrorMessage(err, 'Failed to reset password')),
  });

  const disableMutation = useMutation({
    mutationFn: () => disableAdmin(disableTarget!.id),
    onSuccess: async () => {
      setDisableError(null);
      setDisableTarget(null);
      await invalidateAdmins();
    },
    onError: (err) => setDisableError(getErrorMessage(err, 'Failed to disable admin')),
  });

  const pagination = adminsQuery.data?.pagination;
  const items = adminsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Admins</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage Admin Web accounts (Super Admin only)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormMode('create');
            setEditingAdmin(null);
            setFormError(null);
            setFormOpen(true);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create admin
        </button>
      </div>

      <AdminsFilters
        search={filters.search}
        role={filters.role}
        status={filters.status}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {adminsQuery.isLoading ? <AdminsTableSkeleton /> : null}

      {adminsQuery.isError ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Unable to load admins</h3>
            <p className="mt-2 text-sm text-slate-500">
              Something went wrong while fetching admins. Please try again.
            </p>
            <button
              type="button"
              onClick={() => adminsQuery.refetch()}
              disabled={adminsQuery.isFetching}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {adminsQuery.isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      ) : null}

      {!adminsQuery.isLoading && !adminsQuery.isError ? (
        <>
          <AdminsTable
            items={items}
            currentAdminId={user?.id}
            onEdit={(admin) => {
              setFormMode('edit');
              setEditingAdmin(admin);
              setFormError(null);
              setFormOpen(true);
            }}
            onResetPassword={(admin) => {
              setResetError(null);
              setResetTarget(admin);
            }}
            onDisable={(admin) => {
              setDisableError(null);
              setDisableTarget(admin);
            }}
          />

          {pagination && pagination.totalPages > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.totalItems.toLocaleString()} admins
              </p>
              <NumberedPagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                disabled={adminsQuery.isFetching}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <AdminForm
        open={formOpen}
        mode={formMode}
        admin={editingAdmin}
        isSelf={editingAdmin?.id === user?.id}
        submitting={saveMutation.isPending}
        error={formError}
        onClose={() => {
          if (!saveMutation.isPending) {
            setFormOpen(false);
            setEditingAdmin(null);
            setFormError(null);
          }
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <ResetPasswordModal
        open={Boolean(resetTarget)}
        admin={resetTarget}
        loading={resetMutation.isPending}
        error={resetError}
        onClose={() => {
          if (!resetMutation.isPending) setResetTarget(null);
        }}
        onSubmit={(password) => resetMutation.mutate(password)}
      />

      <ConfirmModal
        open={Boolean(disableTarget)}
        title="Disable admin?"
        description={
          disableTarget
            ? `“${disableTarget.full_name}” will no longer be able to sign in to Admin Web.`
            : 'This admin will no longer be able to sign in.'
        }
        confirmLabel="Disable"
        confirmTone="danger"
        loading={disableMutation.isPending}
        error={disableError}
        onCancel={() => {
          if (!disableMutation.isPending) setDisableTarget(null);
        }}
        onConfirm={() => disableMutation.mutate()}
      />
    </div>
  );
}
