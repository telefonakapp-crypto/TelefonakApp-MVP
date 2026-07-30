import type { SystemHealthStatus } from '../../types/dashboard';

type StatusBadgeProps = {
  label: string;
  status: SystemHealthStatus;
};

export function StatusBadge({ label, status }: StatusBadgeProps) {
  const online = status === 'online';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          online
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
        }`}
      >
        <span
          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
