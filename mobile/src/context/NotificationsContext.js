import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '../utils/authSession';
import apiClient from '../utils/api';
import { logApiError } from '../utils/apiError';
import { syncDevicePushRegistration } from '../utils/pushRegistration';

const NotificationsContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

/**
 * Holds the unread badge count so the bottom nav and the notification list
 * agree without either one polling. It is refreshed on screen focus and
 * adjusted locally whenever the user marks something as read.
 */
export const NotificationsProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlight = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (inFlight.current) return;

    const token = await getAuthToken();
    if (!token) {
      setUnreadCount(0);
      return;
    }

    inFlight.current = true;
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.unread || 0);
    } catch (error) {
      if (
        error?.isMaintenance ||
        error?.name === 'MaintenanceError' ||
        error?.code === 'ERR_MAINTENANCE'
      ) {
        return;
      }
      logApiError('NotificationsContext.refreshUnreadCount', error);
      setUnreadCount(0);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Local adjustments keep the badge honest without another round trip.
  const decrementUnreadCount = useCallback((by = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - by));
  }, []);

  const clearUnreadCount = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAuthToken();
      if (!token || cancelled) return;
      try {
        const response = await apiClient.get('/notifications/preferences');
        if (cancelled || response.data.push_notifications_enabled !== true) return;
        const registration = await syncDevicePushRegistration({ requestPermission: false });
        if (__DEV__ && !cancelled && !registration?.registered) {
          console.log('[push] launch registration skipped', registration?.reason);
        }
      } catch {
        // Preference/token sync is best-effort on launch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      decrementUnreadCount,
      clearUnreadCount,
    }),
    [unreadCount, refreshUnreadCount, decrementUnreadCount, clearUnreadCount]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
