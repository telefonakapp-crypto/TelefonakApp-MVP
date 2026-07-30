import { AdminStatusBadge, RoleBadge } from './AdminBadges';
import type { AdminListItem } from '../../types/admin';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

type AdminsTableProps = {
  items: AdminListItem[];
  currentAdminId?: number;
  onEdit: (admin: AdminListItem) => void;
  onResetPassword: (admin: AdminListItem) => void;
  onDisable: (admin: AdminListItem) => void;
};

export function AdminsTable({
  items,
  currentAdminId,
  onEdit,
  onResetPassword,
  onDisable,
}: AdminsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No admins found</p>
        <p className="mt-1 text-sm text-slate-500">
          Create an admin or adjust your filters.
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
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((admin) => {
              const isSelf = admin.id === currentAdminId;
              return (
                <tr key={admin.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {admin.full_name}
                    {isSelf ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{admin.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={admin.role} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge active={admin.is_active} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {formatDate(admin.last_login)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {formatDate(admin.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(admin)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetPassword(admin)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reset Password
                      </button>
                      {admin.is_active && !isSelf ? (
                        <button
                          type="button"
                          onClick={() => onDisable(admin)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Disable
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminsTableSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
