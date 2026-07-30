import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-600">403</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            Only Super Admins can manage Admin Web accounts.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
