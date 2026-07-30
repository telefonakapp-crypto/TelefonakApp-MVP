import type { AdminRole } from '../../types/admin';

const ROLE_STYLES: Record<AdminRole, string> = {
  super_admin: 'bg-violet-50 text-violet-800',
  moderator: 'bg-sky-50 text-sky-800',
  marketing: 'bg-pink-50 text-pink-800',
  support: 'bg-teal-50 text-teal-800',
  viewer: 'bg-slate-100 text-slate-700',
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  moderator: 'Moderator',
  marketing: 'Marketing',
  support: 'Support',
  viewer: 'Viewer',
};

type RoleBadgeProps = {
  role: AdminRole | string;
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const key = (role in ROLE_STYLES ? role : 'viewer') as AdminRole;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[key]}`}
    >
      {ROLE_LABELS[key]}
    </span>
  );
}

type StatusBadgeProps = {
  active: boolean;
};

export function AdminStatusBadge({ active }: StatusBadgeProps) {
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
