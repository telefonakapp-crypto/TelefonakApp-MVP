import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ListingsPage } from '../pages/listings/ListingsPage';
import { BannersPage } from '../pages/banners/BannersPage';
import { AdminsPage } from '../pages/admins/AdminsPage';
import { UsersPage } from '../pages/users/UsersPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AuditLogsPage } from '../pages/audit/AuditLogsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { SuperAdminRoute } from './SuperAdminRoute';
import { useAuth } from '../hooks/useAuth';

function LoginRoute() {
  const { isAuthenticated, isAdmin } = useAuth();

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginRoute />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/listings', element: <ListingsPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/banners', element: <BannersPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          {
            element: <SuperAdminRoute />,
            children: [{ path: '/admins', element: <AdminsPage /> }],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
