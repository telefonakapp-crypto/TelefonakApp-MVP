import apiClient from './apiClient';
import type { DashboardResponse } from '../types/dashboard';

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/admin/dashboard');
  return data;
}
