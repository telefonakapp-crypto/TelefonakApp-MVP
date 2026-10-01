import type { ReactNode } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const PALETTE = [
  '#0f172a',
  '#334155',
  '#64748b',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

type ChartCardProps = {
  title: string;
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
};

export function ChartCard({ title, children, empty, emptyMessage, height }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4" style={{ height: height ?? 256 }}>
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {emptyMessage ?? 'No data for this period'}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-4 h-64 rounded bg-slate-100" />
    </div>
  );
}

type SeriesChartProps = {
  labels: string[];
  values: number[];
  label: string;
};

export function LineChartCard({
  title,
  labels,
  values,
  label,
}: SeriesChartProps & { title: string }) {
  return (
    <ChartCard title={title} empty={labels.length === 0}>
      <Line
        data={{
          labels,
          datasets: [
            {
              label,
              data: values,
              borderColor: '#0f172a',
              backgroundColor: 'rgba(15, 23, 42, 0.08)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
              grid: { color: 'rgba(148, 163, 184, 0.25)' },
            },
          },
        }}
      />
    </ChartCard>
  );
}

export function BarChartCard({
  title,
  labels,
  values,
  label,
  formatValue,
  horizontal = false,
  emptyMessage,
}: SeriesChartProps & {
  title: string;
  formatValue?: (value: number) => string;
  horizontal?: boolean;
  emptyMessage?: string;
}) {
  const height = horizontal ? Math.max(256, labels.length * 36) : undefined;

  return (
    <ChartCard title={title} empty={labels.length === 0} emptyMessage={emptyMessage} height={height}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label,
              data: values,
              backgroundColor: labels.map((_, index) => PALETTE[index % PALETTE.length]),
              borderRadius: 6,
            },
          ],
        }}
        options={{
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: formatValue
                ? {
                    label: (context) => {
                      const parsed = context.parsed as { x?: number; y?: number } | number;
                      const raw =
                        typeof parsed === 'number'
                          ? parsed
                          : Number(parsed?.[horizontal ? 'x' : 'y'] ?? context.raw ?? 0);
                      return formatValue(raw);
                    },
                  }
                : undefined,
            },
          },
          scales: {
            x: horizontal
              ? {
                  beginAtZero: true,
                  ticks: { precision: 0 },
                  grid: { color: 'rgba(148, 163, 184, 0.25)' },
                }
              : { grid: { display: false } },
            y: horizontal
              ? {
                  grid: { display: false },
                  ticks: { autoSkip: false },
                }
              : {
                  beginAtZero: true,
                  ticks: { precision: 0 },
                  grid: { color: 'rgba(148, 163, 184, 0.25)' },
                },
          },
        }}
      />
    </ChartCard>
  );
}

type ArcChartProps = {
  title: string;
  labels: string[];
  values: number[];
  variant?: 'pie' | 'doughnut';
  emptyMessage?: string;
};

export function ArcChartCard({
  title,
  labels,
  values,
  variant = 'pie',
  emptyMessage,
}: ArcChartProps) {
  const ChartComponent = variant === 'doughnut' ? Doughnut : Pie;
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <ChartCard
      title={title}
      empty={labels.length === 0 || total === 0}
      emptyMessage={emptyMessage}
    >
      <ChartComponent
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: labels.map((_, index) => PALETTE[index % PALETTE.length]),
              borderWidth: 1,
              borderColor: '#ffffff',
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 11 } },
            },
          },
        }}
      />
    </ChartCard>
  );
}
