import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../utils/api';

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

    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      setUnreadCount(0);
      return;
    }

    // Settings lets the user silence the badge entirely.
    const pushPreference = await AsyncStorage.getItem('pushNotificationsEnabled');
    if (pushPreference === 'false') {
      setUnreadCount(0);
      return;
    }

    inFlight.current = true;
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.unread || 0);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
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
