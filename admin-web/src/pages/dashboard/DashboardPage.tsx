import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../services/dashboardService';
import { DashboardCard, DashboardCardSkeleton } from '../../components/dashboard/DashboardCard';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import {
  RecentListingsTable,
  RecentListingsTableSkeleton,
} from '../../components/dashboard/RecentListingsTable';

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Marketplace overview</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <DashboardCardSkeleton key={index} />
          ))}
        </div>
        <RecentListingsTableSkeleton />
      </div>
    );
  }

  if (isError || !data?.stats) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Unable to load dashboard</h2>
          <p className="mt-2 text-sm text-slate-500">
            Something went wrong while fetching marketplace statistics. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const { stats, recentListings, systemHealth } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Marketplace overview</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusBadge label="Database" status={systemHealth.database} />
          <StatusBadge label="API" status={systemHealth.api} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Total Users" value={stats.totalUsers} />
        <DashboardCard label="Total Admins" value={stats.totalAdmins} />
        <DashboardCard
          label="Active Listings"
          value={stats.activeListings}
          hint="Approved & live"
          to="/listings?status=approved"
        />
        <DashboardCard
          label="Pending Listings"
          value={stats.pendingListings}
          to="/listings?status=pending"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Resubmitted Queue"
          value={stats.resubmittedListings ?? 0}
          hint="Awaiting re-review now"
          to="/listings?status=resubmitted"
        />
        <DashboardCard
          label="Updated Queue"
          value={stats.updatedListings ?? 0}
          hint="Currently awaiting moderation"
          to="/listings?status=updated"
        />
        <DashboardCard
          label="Resubmissions (Month)"
          value={stats.resubmissionsReceivedThisMonth ?? 0}
          hint="Historical events this month"
          to="/moderation-history?type=resubmitted"
        />
        <DashboardCard
          label="Updates (Month)"
          value={stats.updatesReceivedThisMonth ?? 0}
          hint="Historical events this month"
          to="/moderation-history?type=updated"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Approved Listings"
          value={stats.approvedListings}
          to="/listings?status=approved"
        />
        <DashboardCard
          label="Declined Listings"
          value={stats.declinedListings}
          to="/listings?status=declined"
        />
        <DashboardCard
          label="Sold Listings"
          value={stats.soldListings}
          to="/listings?status=sold"
        />
        <DashboardCard label="Active Banners" value={stats.activeBanners} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Listings
        </h3>
        <RecentListingsTable listings={recentListings} />
      </section>
    </div>
  );
}
