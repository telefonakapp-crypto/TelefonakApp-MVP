import apiClient from './apiClient';
import { getStoredToken } from '../utils/storage';
import type {
  ReportExportType,
  ReportRangeDays,
  ReportsCharts,
  ReportsOverview,
} from '../types/report';

export async function fetchReportsOverview(): Promise<ReportsOverview> {
  const { data } = await apiClient.get<ReportsOverview>('/admin/reports/overview');
  return data;
}

export async function fetchReportsCharts(
  days: ReportRangeDays
): Promise<ReportsCharts> {
  const { data } = await apiClient.get<ReportsCharts>('/admin/reports/charts', {
    params: { days },
  });
  return data;
}

export async function downloadReportCsv(type: ReportExportType): Promise<void> {
  const baseURL = apiClient.defaults.baseURL || 'http://localhost:3000/api';
  const token = getStoredToken();

  const response = await fetch(`${baseURL}/admin/reports/export?type=${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = 'Failed to export CSV';
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `telefonak-${type}.csv`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
