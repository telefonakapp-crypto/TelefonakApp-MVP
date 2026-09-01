import { Link } from 'react-router-dom';

type DashboardCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  to?: string;
};

export function DashboardCard({ label, value, hint, to }: DashboardCardProps) {
  const body = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{body}</div>
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
