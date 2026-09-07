import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, superAdminOnly: false },
  { to: '/listings', label: 'Listings', end: false, superAdminOnly: false },
  { to: '/moderation-history', label: 'Moderation History', end: false, superAdminOnly: false },
  { to: '/users', label: 'Users', end: false, superAdminOnly: false },
  { to: '/banners', label: 'Banners', end: false, superAdminOnly: false },
  { to: '/notifications', label: 'Notifications', end: false, superAdminOnly: false },
  { to: '/reports', label: 'Reports', end: false, superAdminOnly: false },
  { to: '/settings', label: 'Settings', end: false, superAdminOnly: false },
  { to: '/audit-logs', label: 'Audit Logs', end: false, superAdminOnly: false },
  { to: '/admins', label: 'Admins', end: false, superAdminOnly: true },
];

export function Sidebar() {
  const { hasPermission } = useAuth();
  const items = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || hasPermission(PERMISSIONS.ADMINS_MANAGE)
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-sm font-semibold tracking-wide text-slate-900">Telefonak</p>
        <p className="text-xs text-slate-500">Admin</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
