import axios from 'axios';
import { API_BASE_URL, API_ORIGIN, resolveMediaUrl } from '../config/apiConfig';
import * as AuthSession from './authSession';
import { shouldClearAuthOnRefreshFailure } from './sessionRestore';

// Shared axios client — base URL comes from EXPO_PUBLIC_API_URL via apiConfig.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Refresh must not share interceptors / AbortSignals with in-flight GETs.
// Android OkHttp cancels a POST that reuses the same AbortSignal as a just-completed GET.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshInFlight = null;

function leaveAuthenticatedSession() {
  try {
    getMaintenanceHelpers().resetToAuthChoice?.();
  } catch {
    // Navigator may not be mounted yet (cold start).
  }
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await AuthSession.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshClient.post(
        '/auth/refresh',
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const nextAccess = response.data?.token;
      const nextRefresh = response.data?.refresh_token;
      if (!nextAccess || !nextRefresh) {
        await AuthSession.clearAuthSession();
        leaveAuthenticatedSession();
        return null;
      }
      await AuthSession.setAuthSession(response.data);
      return nextAccess;
    } catch (error) {
      if (shouldClearAuthOnRefreshFailure(error)) {
        await AuthSession.clearAuthSession();
        leaveAuthenticatedSession();
      } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const status = error?.response?.status;
        console.log(
          '[auth] refresh failed; session preserved',
          status ? `status=${status}` : error?.code || error?.name || 'network'
        );
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function getMaintenanceHelpers() {
  // Lazy require avoids a circular import with maintenance helpers.
  return require('./maintenance');
}

/**
 * Give every request its own AbortController. Reusing one signal across
 * requests is cancelled by Android after the first fetch completes.
 * Maintenance still aborts in-flight work via the shared maintenance signal.
 */
function attachPerRequestAbortSignal(config, maintenanceSignal) {
  const requestController = new AbortController();
  const callerSignal = config.signal;

  const onAbort = () => {
    try {
      requestController.abort();
    } catch {
      // ignore
    }
  };

  if (callerSignal?.aborted || maintenanceSignal?.aborted) {
    requestController.abort();
  } else {
    if (callerSignal && typeof callerSignal.addEventListener === 'function') {
      callerSignal.addEventListener('abort', onAbort, { once: true });
    }
    if (maintenanceSignal && typeof maintenanceSignal.addEventListener === 'function') {
      maintenanceSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  config.signal = requestController.signal;
}

/**
 * Attach maintenance request/response handling to an axios instance.
 * Applied to both apiClient and the default axios export so screens that still
 * call axios.get/post directly cannot bypass the gate.
 */
function attachMaintenanceInterceptors(client) {
  client.interceptors.request.use(
    async (config) => {
      const {
        isMaintenanceActive,
        createMaintenanceError,
        getMaintenanceAbortSignal,
        isMaintenanceExemptRequestUrl,
      } = getMaintenanceHelpers();

      const requestUrl = `${config.baseURL || ''}${config.url || ''}`;
      const exempt = isMaintenanceExemptRequestUrl(requestUrl);

      if (isMaintenanceActive() && !exempt) {
        return Promise.reject(createMaintenanceError());
      }

      if (!exempt) {
        const maintenanceSignal = getMaintenanceAbortSignal();
        if (maintenanceSignal) {
          attachPerRequestAbortSignal(config, maintenanceSignal);
        }
      }

      try {
        if (AuthSession.getRequestAuthorization(config)) {
          return config;
        }

        const token = await AuthSession.getAuthToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[API] Failed to read auth token for request', error?.message);
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      try {
        const {
          isMaintenanceResponse,
          isMaintenanceActive,
          isMaintenanceError,
          activateMaintenanceMode,
          createMaintenanceError,
        } = getMaintenanceHelpers();

        if (isMaintenanceResponse(error)) {
          return Promise.reject(activateMaintenanceMode(error));
        }

        if (isMaintenanceActive() || isMaintenanceError(error)) {
          return Promise.reject(
            isMaintenanceError(error) ? error : createMaintenanceError(error)
          );
        }
      } catch (interceptorError) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[API] Maintenance interceptor error', interceptorError?.message);
        }
      }

      const status = error?.response?.status;
      const original = error?.config;
      const url = `${original?.baseURL || ''}${original?.url || ''}`;
      const isAuthEndpoint =
        /\/auth\/(refresh|logout|request-otp|verify-otp)/.test(url) ||
        /\/admin\/auth\//.test(url);

      if (
        status === 401 &&
        original &&
        !original._telefonakRetry &&
        !isAuthEndpoint
      ) {
        original._telefonakRetry = true;
        const nextAccess = await refreshAccessToken();
        if (nextAccess) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${nextAccess}`;
          return client.request(original);
        }
      }

      return Promise.reject(error);
    }
  );
}

attachMaintenanceInterceptors(apiClient);
// Cover legacy screens that call axios directly instead of apiClient.
attachMaintenanceInterceptors(axios);

export default apiClient;
export { API_BASE_URL, API_ORIGIN, resolveMediaUrl };
