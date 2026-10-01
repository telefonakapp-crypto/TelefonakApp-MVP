import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';

export function AdminLayout() {
  const { pathname } = useLocation();
  const isNotifications = pathname.startsWith('/notifications');

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {isNotifications ? null : <Topbar />}
        <main
          className={
            isNotifications
              ? 'flex-1 overflow-auto'
              : 'flex-1 overflow-auto p-4 md:p-6'
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
