/**
 * Pure session-restore helpers used when leaving maintenance or handling
 * refresh-token failures. Kept free of React Native imports so Node can test them.
 */

/**
 * Route to open after maintenance ends. Refresh tokens count as a live
 * customer session even when the short-lived access JWT is missing/expired.
 */
export function resolvePostMaintenanceRoute({
  hasSeenOnboarding,
  sessionKind,
  refreshToken,
} = {}) {
  if (hasSeenOnboarding !== true) {
    return 'Onboarding';
  }
  if (sessionKind === 'customer' || (typeof refreshToken === 'string' && refreshToken.length > 0)) {
    return 'Home';
  }
  return 'AuthChoice';
}

/**
 * Only a genuine refresh-endpoint auth failure should wipe SecureStore.
 * Maintenance 503s, network errors, and 5xx must not log the user out.
 */
export function shouldClearAuthOnRefreshFailure(error) {
  if (!error) return false;
  if (
    error.isMaintenance === true ||
    error.name === 'MaintenanceError' ||
    error.code === 'ERR_MAINTENANCE'
  ) {
    return false;
  }
  const status = error.response?.status;
  if (status == null) return false;
  if (status === 503) return false;
  return status === 401 || status === 403;
}
