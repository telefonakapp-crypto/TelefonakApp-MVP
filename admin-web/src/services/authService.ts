import apiClient from './apiClient';
import type { AuthSession } from '../types/auth';

type LoginResponse = {
  token: string;
  admin: AuthSession['user'];
};

export async function loginAdmin(email: string, password: string): Promise<AuthSession> {
  const { data } = await apiClient.post<LoginResponse>('/admin/auth/login', {
    email,
    password,
  });

  return {
    token: data.token,
    user: data.admin,
  };
}

export async function fetchCurrentAdmin(): Promise<AuthSession['user']> {
  const { data } = await apiClient.get<{ admin: AuthSession['user'] }>('/admin/auth/me');
  return data.admin;
}
