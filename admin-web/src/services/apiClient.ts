import axios from 'axios';
import { clearSession, getStoredToken } from '../utils/storage';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const LOGIN_ENDPOINT = '/admin/auth/login';

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    // A rejected sign-in must surface its own message instead of wiping state.
    if (status === 401 && !requestUrl.includes(LOGIN_ENDPOINT)) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
