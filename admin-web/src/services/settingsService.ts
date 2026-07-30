import apiClient from './apiClient';
import type { MarketplaceSettings, SettingsResponse } from '../types/settings';

export async function fetchSettings(): Promise<SettingsResponse> {
  const { data } = await apiClient.get<SettingsResponse>('/admin/settings');
  return data;
}

export async function updateSettings(
  settings: Partial<MarketplaceSettings>
): Promise<SettingsResponse> {
  const { data } = await apiClient.put<SettingsResponse>('/admin/settings', {
    settings,
  });
  return data;
}
