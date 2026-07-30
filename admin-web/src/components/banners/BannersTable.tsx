import { BannerStatusBadge } from './BannerStatusBadge';
import type { Banner } from '../../types/banner';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

type BannersTableProps = {
  banners: Banner[];
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
};

export function BannersTable({ banners, onEdit, onDelete }: BannersTableProps) {
  if (banners.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No banners found</p>
        <p className="mt-1 text-sm text-slate-500">
          Create a banner or adjust your filters.
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
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Subtitle</th>
              <th className="px-4 py-3">CTA Text</th>
              <th className="px-4 py-3">CTA Link</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">End Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {banners.map((banner) => (
              <tr key={banner.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  {banner.image_url ? (
                    <img
                      src={banner.image_url}
                      alt=""
                      className="h-12 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                      N/A
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{banner.title}</td>
                <td className="px-4 py-3 text-slate-600">{banner.subtitle || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{banner.cta_text || '—'}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                  {banner.cta_link || banner.action_value || '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(banner.starts_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(banner.ends_at)}
                </td>
                <td className="px-4 py-3">
                  <BannerStatusBadge status={banner.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(banner)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(banner)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BannersTableSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <div className="h-12 w-20 rounded-lg bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
