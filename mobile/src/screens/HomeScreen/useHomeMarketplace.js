import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../utils/api';
import { logApiError } from '../../utils/apiError';
import {
  EMPTY_MARKETPLACE_FILTERS,
  buildMarketplaceListingParams,
  normalizeMarketplaceSearch,
} from '../../utils/marketplaceFilters';

const MARKETPLACE_PAGE_SIZE = 20;

export function useHomeMarketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoadError, setListingsLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({ ...EMPTY_MARKETPLACE_FILTERS });
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const listingsRequestIdRef = useRef(0);
  const listingsAbortRef = useRef(null);

  const fetchListings = React.useCallback(async (
    search = '',
    appliedFilters = {},
    { offset = 0, append = false } = {}
  ) => {
    if (listingsAbortRef.current) {
      listingsAbortRef.current.abort();
    }
    const controller = new AbortController();
    listingsAbortRef.current = controller;
    const requestId = ++listingsRequestIdRef.current;

    try {
      const params = buildMarketplaceListingParams(appliedFilters, {
        search,
        limit: MARKETPLACE_PAGE_SIZE,
        offset,
      });
      const response = await apiClient.get(`/listings?${params.toString()}`, {
        signal: controller.signal,
      });

      // Ignore stale responses (race between search/filter pages).
      if (requestId !== listingsRequestIdRef.current) {
        return [];
      }

      const fetchedListings = response.data.listings || [];
      setListingsLoadError(false);
      setListings((prev) => {
        if (!append) return fetchedListings;
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        fetchedListings.forEach((item) => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        });
        return merged;
      });
      setHasMoreListings(fetchedListings.length >= MARKETPLACE_PAGE_SIZE);
      return fetchedListings;
    } catch (error) {
      if (
        error?.isMaintenance ||
        error?.name === 'MaintenanceError' ||
        error?.code === 'ERR_MAINTENANCE' ||
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError'
      ) {
        return [];
      }
      logApiError('HomeScreen.fetchListings', error);
      if (requestId === listingsRequestIdRef.current && !append) {
        setListingsLoadError(true);
        setListings([]);
        setHasMoreListings(false);
      }
      return [];
    } finally {
      if (requestId === listingsRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Debounce search input (~300ms) to avoid excessive API calls while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(normalizeMarketplaceSearch(searchQuery));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setLoading(true);
    setHasMoreListings(true);
    fetchListings(debouncedSearchQuery, filters, { offset: 0, append: false });
  }, [fetchListings, debouncedSearchQuery, filters]);

  useFocusEffect(
    React.useCallback(() => {
      fetchListings(debouncedSearchQuery, filters, { offset: 0, append: false });
    }, [fetchListings, debouncedSearchQuery, filters])
  );

  const refreshListings = () => {
    setRefreshing(true);
    setHasMoreListings(true);
    fetchListings(debouncedSearchQuery, filters, { offset: 0, append: false });
  };

  const handleLoadMoreListings = () => {
    if (loading || loadingMore || refreshing || !hasMoreListings || listings.length === 0) {
      return;
    }
    setLoadingMore(true);
    fetchListings(debouncedSearchQuery, filters, {
      offset: listings.length,
      append: true,
    });
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    searchInputRef.current?.blur();
  };

  return {
    listings,
    loading,
    listingsLoadError,
    refreshing,
    searchQuery,
    debouncedSearchQuery,
    searchInputRef,
    filters,
    setFilters,
    hasMoreListings,
    loadingMore,
    fetchListings,
    refreshListings,
    handleLoadMoreListings,
    handleSearchChange,
    handleClearSearch,
    setLoading,
  };
}
