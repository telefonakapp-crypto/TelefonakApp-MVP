import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';

const FavoritesContext = createContext(null);

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

/**
 * Single source of truth for favorite listing ids so the listing cards,
 * listing details, and saved listings screen never disagree.
 *
 * Reads go through state; writes also update refs so the exposed callbacks
 * can stay referentially stable and not re-trigger screen effects.
 */
export const FavoritesProvider = ({ children }) => {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const favoriteIdsRef = useRef(favoriteIds);
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  const applyFavoriteIds = useCallback((nextSet) => {
    favoriteIdsRef.current = nextSet;
    setFavoriteIds(nextSet);
  }, []);

  const setFavoriteState = useCallback(
    (listingId, favorited) => {
      const next = new Set(favoriteIdsRef.current);
      if (favorited) next.add(listingId);
      else next.delete(listingId);
      applyFavoriteIds(next);
    },
    [applyFavoriteIds]
  );

  const loadFavorites = useCallback(
    async ({ force = false } = {}) => {
      if (loadingRef.current) return;
      if (loadedRef.current && !force) return;

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        applyFavoriteIds(new Set());
        loadedRef.current = true;
        return;
      }

      loadingRef.current = true;
      try {
        const response = await apiClient.get('/favorites/ids');
        applyFavoriteIds(new Set((response.data.listing_ids || []).map(Number)));
        loadedRef.current = true;
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        loadingRef.current = false;
      }
    },
    [applyFavoriteIds]
  );

  const markPending = useCallback((listingId, pending) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  }, []);

  /**
   * Optimistically flips the heart, then reverts if the request fails.
   * @returns {Promise<boolean>} the resulting favorite state
   */
  const toggleFavorite = useCallback(
    async (rawListingId) => {
      const listingId = Number(rawListingId);
      if (!Number.isFinite(listingId) || listingId <= 0) return false;

      const wasFavorite = favoriteIdsRef.current.has(listingId);
      const nextFavorite = !wasFavorite;

      setFavoriteState(listingId, nextFavorite);
      markPending(listingId, true);

      try {
        if (nextFavorite) {
          await apiClient.post(`/favorites/${listingId}`);
        } else {
          await apiClient.delete(`/favorites/${listingId}`);
        }
        return nextFavorite;
      } catch (error) {
        // Removing something that is already gone still lands on the desired state.
        if (!nextFavorite && error.response?.status === 404) {
          return false;
        }

        logApiError('FavoritesContext.toggleFavorite', error);
        setFavoriteState(listingId, wasFavorite);
        Alert.alert(
          'Error',
          getApiErrorMessage(error, "We couldn't update your saved listings. Please try again.")
        );
        return wasFavorite;
      } finally {
        markPending(listingId, false);
      }
    },
    [markPending, setFavoriteState]
  );

  const clearFavorites = useCallback(() => {
    applyFavoriteIds(new Set());
    setPendingIds(new Set());
    loadedRef.current = false;
  }, [applyFavoriteIds]);

  const value = useMemo(
    () => ({
      favoriteIds,
      favoritesCount: favoriteIds.size,
      isFavorite: (listingId) => favoriteIds.has(Number(listingId)),
      isPending: (listingId) => pendingIds.has(Number(listingId)),
      loadFavorites,
      toggleFavorite,
      clearFavorites,
    }),
    [favoriteIds, pendingIds, loadFavorites, toggleFavorite, clearFavorites]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};
