import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../utils/authSession';
import apiClient from '../utils/api';
import { logApiError } from '../utils/apiError';

const OffersUnreadContext = createContext(null);

export const useOffersUnread = () => {
  const context = useContext(OffersUnreadContext);
  if (!context) {
    throw new Error('useOffersUnread must be used within an OffersUnreadProvider');
  }
  return context;
};

/**
 * Cached unread received-offer count for the Offers tab badge.
 * Source of truth: GET /offers/received/unread-count
 * (pending offers for the authenticated seller with seller_seen_at IS NULL).
 */
export const OffersUnreadProvider = ({ children }) => {
  const [unreadOffersCount, setUnreadOffersCount] = useState(0);
  const inFlight = useRef(false);

  const refreshUnreadOffersCount = useCallback(async () => {
    if (inFlight.current) return;

    const token = await getAuthToken();
    if (!token) {
      setUnreadOffersCount(0);
      return;
    }

    inFlight.current = true;
    try {
      const response = await apiClient.get('/offers/received/unread-count');
      setUnreadOffersCount(response.data.unread || 0);
    } catch (error) {
      if (
        error?.isMaintenance ||
        error?.name === 'MaintenanceError' ||
        error?.code === 'ERR_MAINTENANCE'
      ) {
        return;
      }
      logApiError('OffersUnreadContext.refreshUnreadOffersCount', error);
      setUnreadOffersCount(0);
    } finally {
      inFlight.current = false;
    }
  }, []);

  const decrementUnreadOffersCount = useCallback((by = 1) => {
    setUnreadOffersCount((prev) => Math.max(0, prev - by));
  }, []);

  const clearUnreadOffersCount = useCallback(() => setUnreadOffersCount(0), []);

  const value = useMemo(
    () => ({
      unreadOffersCount,
      refreshUnreadOffersCount,
      decrementUnreadOffersCount,
      clearUnreadOffersCount,
    }),
    [
      unreadOffersCount,
      refreshUnreadOffersCount,
      decrementUnreadOffersCount,
      clearUnreadOffersCount,
    ]
  );

  return (
    <OffersUnreadContext.Provider value={value}>{children}</OffersUnreadContext.Provider>
  );
};
