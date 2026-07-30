type DashboardCardProps = {
  label: string;
  value: number | string;
  hint?: string;
};

export function DashboardCard({ label, value, hint }: DashboardCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
    </div>
  );
}
