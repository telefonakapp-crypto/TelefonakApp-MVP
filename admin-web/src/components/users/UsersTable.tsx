import type { MarketplaceUserListItem } from '../../types/user';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

type UsersTableProps = {
  items: MarketplaceUserListItem[];
  onView: (id: number) => void;
};

export function UserStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

export function UsersTable({ items, onView }: UsersTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No users found</p>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting your search or filters.
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
              <th className="px-4 py-3">Avatar</th>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Phone Number</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {initials(user.full_name)}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{user.full_name}</td>
                <td className="px-4 py-3 text-slate-700">{user.phone_number}</td>
                <td className="px-4 py-3 text-slate-700">
                  {user.total_listings.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <UserStatusBadge active={user.is_active} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(user.id)}
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

export function UsersTableSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
