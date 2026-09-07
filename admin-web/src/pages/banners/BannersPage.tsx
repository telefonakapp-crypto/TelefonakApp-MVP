import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  updateBanner,
} from '../../services/bannerService';
import { BannersFilters } from '../../components/banners/BannersFilters';
import {
  BannersTable,
  BannersTableSkeleton,
} from '../../components/banners/BannersTable';
import { BannerForm } from '../../components/banners/BannerForm';
import { ConfirmModal } from '../../components/listings/ConfirmModal';
import type { Banner, BannerPayload } from '../../types/banner';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';

type FiltersState = {
  search: string;
  status: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  status: '',
};

export function BannersPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWriteBanners = hasPermission(PERMISSIONS.BANNERS_WRITE);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleFilterChange = useCallback((next: Partial<FiltersState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const queryParams = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
    }),
    [filters]
  );

  const bannersQuery = useQuery({
    queryKey: ['admin-banners', queryParams],
    queryFn: () => fetchBanners(queryParams),
  });

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: BannerPayload) => {
      if (formMode === 'edit' && editingBanner) {
        return updateBanner(editingBanner.id, payload);
      }
      return createBanner(payload);
    },
    onSuccess: async () => {
      setFormError(null);
      setFormOpen(false);
      setEditingBanner(null);
      await invalidateRelated();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save banner';
      setFormError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBanner(id),
    onSuccess: async () => {
      setDeleteError(null);
      setDeleteTarget(null);
      await invalidateRelated();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete banner';
      setDeleteError(message);
    },
  });

  const openCreate = () => {
    setFormMode('create');
    setEditingBanner(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setFormMode('edit');
    setEditingBanner(banner);
    setFormError(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Banners</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage home screen marketing banners
          </p>
        </div>
        {canWriteBanners ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create banner
          </button>
        ) : null}
      </div>

      <BannersFilters
        search={filters.search}
        status={filters.status}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {bannersQuery.isLoading ? <BannersTableSkeleton /> : null}

      {bannersQuery.isError ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Unable to load banners</h3>
            <p className="mt-2 text-sm text-slate-500">
              Something went wrong while fetching banners. Please try again.
            </p>
            <button
              type="button"
              onClick={() => bannersQuery.refetch()}
              disabled={bannersQuery.isFetching}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {bannersQuery.isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      ) : null}

      {!bannersQuery.isLoading && !bannersQuery.isError ? (
        <BannersTable
          banners={bannersQuery.data ?? []}
          canWrite={canWriteBanners}
          onEdit={openEdit}
          onDelete={(banner) => {
            setDeleteError(null);
            setDeleteTarget(banner);
          }}
        />
      ) : null}

      <BannerForm
        open={formOpen}
        mode={formMode}
        banner={editingBanner}
        submitting={saveMutation.isPending}
        error={formError}
        onClose={() => {
          if (!saveMutation.isPending) {
            setFormOpen(false);
            setEditingBanner(null);
            setFormError(null);
          }
        }}
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete banner?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be permanently removed from the home carousel.`
            : 'This banner will be permanently removed.'
        }
        confirmLabel="Delete"
        confirmTone="danger"
        loading={deleteMutation.isPending}
        error={deleteError}
        onCancel={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
