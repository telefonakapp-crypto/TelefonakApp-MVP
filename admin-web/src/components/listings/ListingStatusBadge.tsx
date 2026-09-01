const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  resubmitted: 'bg-sky-50 text-sky-800',
  updated: 'bg-indigo-50 text-indigo-800',
  approved: 'bg-emerald-50 text-emerald-800',
  declined: 'bg-red-50 text-red-800',
  sold: 'bg-slate-100 text-slate-700',
  hidden: 'bg-violet-50 text-violet-800',
  deleted: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  resubmitted: 'Resubmitted',
  updated: 'Updated',
  approved: 'Approved',
  declined: 'Declined',
  sold: 'Sold',
  hidden: 'Hidden',
  deleted: 'Deleted',
};

type ListingStatusBadgeProps = {
  status: string;
};

export function ListingStatusBadge({ status }: ListingStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
