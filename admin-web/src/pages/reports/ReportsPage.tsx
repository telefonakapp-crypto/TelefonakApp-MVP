import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  downloadReportCsv,
  fetchReportsCharts,
  fetchReportsOverview,
} from '../../services/reportService';
import { DashboardCard, DashboardCardSkeleton } from '../../components/dashboard/DashboardCard';
import {
  ArcChartCard,
  BarChartCard,
  ChartSkeleton,
  LineChartCard,
} from '../../components/reports/ReportCharts';
import type { ReportExportType, ReportRangeDays } from '../../types/report';

const RANGE_OPTIONS: Array<{ value: ReportRangeDays; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function ReportsPage() {
  const [days, setDays] = useState<ReportRangeDays>(30);
  const [exporting, setExporting] = useState<ReportExportType | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['admin-reports-overview'],
    queryFn: fetchReportsOverview,
  });

  const chartsQuery = useQuery({
    queryKey: ['admin-reports-charts', days],
    queryFn: () => fetchReportsCharts(days),
  });

  const handleExport = async (type: ReportExportType) => {
    setExportError(null);
    setExporting(type);
    try {
      await downloadReportCsv(type);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(null);
    }
  };

  const overviewLoading = overviewQuery.isLoading;
  const overviewError = overviewQuery.isError;
  const chartsLoading = chartsQuery.isLoading;
  const chartsError = chartsQuery.isError;
  const overview = overviewQuery.data;
  const charts = chartsQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
        <p className="mt-1 text-sm text-slate-500">
          Read-only marketplace analytics and CSV exports
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Overview
          </h3>
          {overviewError ? (
            <button
              type="button"
              onClick={() => overviewQuery.refetch()}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Retry overview
            </button>
          ) : null}
        </div>

        {overviewLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <DashboardCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {overviewError ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Unable to load overview</p>
            <p className="mt-1 text-sm text-slate-500">Please try again.</p>
          </div>
        ) : null}

        {overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard label="Total Users" value={overview.users.total} />
              <DashboardCard label="Active Users" value={overview.users.active} />
              <DashboardCard label="Disabled Users" value={overview.users.disabled} />
              <DashboardCard label="New Users (Month)" value={overview.users.newThisMonth} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard label="Total Listings" value={overview.listings.total} />
              <DashboardCard label="Pending Listings" value={overview.listings.pending} />
              <DashboardCard label="Approved Listings" value={overview.listings.approved} />
              <DashboardCard label="Sold Listings" value={overview.listings.sold} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard label="Total Offers" value={overview.offers.total} />
              <DashboardCard label="Pending Offers" value={overview.offers.pending} />
              <DashboardCard label="Accepted Offers" value={overview.offers.accepted} />
              <DashboardCard label="Active Banners" value={overview.banners.active} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Charts
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDays(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  days === option.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
            {chartsError ? (
              <button
                type="button"
                onClick={() => chartsQuery.refetch()}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Retry charts
              </button>
            ) : null}
          </div>
        </div>

        {chartsLoading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <ChartSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {chartsError ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Unable to load charts</p>
            <p className="mt-1 text-sm text-slate-500">Please try again.</p>
          </div>
        ) : null}

        {charts ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LineChartCard
              title="User registrations"
              label="Users"
              labels={charts.userRegistrations.map((point) => point.date.slice(5))}
              values={charts.userRegistrations.map((point) => point.count)}
            />
            <LineChartCard
              title="Listings created"
              label="Listings"
              labels={charts.listingsCreated.map((point) => point.date.slice(5))}
              values={charts.listingsCreated.map((point) => point.count)}
            />
            <BarChartCard
              title="Top brands"
              label="Listings"
              labels={charts.listingsByBrand.map((item) => item.label)}
              values={charts.listingsByBrand.map((item) => item.count)}
            />
            <ArcChartCard
              title="Listing status"
              variant="pie"
              labels={charts.listingStatusDistribution.map((item) => item.label)}
              values={charts.listingStatusDistribution.map((item) => item.count)}
            />
            <BarChartCard
              title="Average price by brand"
              label="Avg price (JOD)"
              labels={charts.averagePriceByBrand.map((item) => item.label)}
              values={charts.averagePriceByBrand.map((item) => item.value)}
              formatValue={(value) => `${value.toLocaleString()} JOD`}
            />
            <ArcChartCard
              title="Listing condition"
              variant="doughnut"
              labels={charts.listingsByCondition.map((item) => item.label)}
              values={charts.listingsByCondition.map((item) => item.count)}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Export
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Download CSV snapshots of marketplace data. Exports are generated by the backend.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ExportButton
              label="Export Users CSV"
              loading={exporting === 'users'}
              disabled={Boolean(exporting)}
              onClick={() => handleExport('users')}
            />
            <ExportButton
              label="Export Listings CSV"
              loading={exporting === 'listings'}
              disabled={Boolean(exporting)}
              onClick={() => handleExport('listings')}
            />
            <ExportButton
              label="Export Offers CSV"
              loading={exporting === 'offers'}
              disabled={Boolean(exporting)}
              onClick={() => handleExport('offers')}
            />
          </div>
          {exportError ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ExportButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {loading ? 'Preparing…' : label}
    </button>
  );
}
