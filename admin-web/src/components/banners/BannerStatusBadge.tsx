import type { BannerLifecycleStatus } from '../../types/banner';

const STATUS_STYLES: Record<BannerLifecycleStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800',
  scheduled: 'bg-sky-50 text-sky-800',
  expired: 'bg-slate-100 text-slate-600',
  disabled: 'bg-amber-50 text-amber-800',
};

const STATUS_LABELS: Record<BannerLifecycleStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  disabled: 'Disabled',
};

type BannerStatusBadgeProps = {
  status: BannerLifecycleStatus | string;
};

export function BannerStatusBadge({ status }: BannerStatusBadgeProps) {
  const key = (status in STATUS_STYLES ? status : 'disabled') as BannerLifecycleStatus;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[key]
      }`}
    >
      {STATUS_LABELS[key]}
    </span>
  );
}
