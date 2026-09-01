import { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/api';

/**
 * Fetches GET /api/models/:modelId/watch-options for a smartwatch model.
 * Disabled when `enabled` is false or `modelId` is missing.
 */
export function useWatchOptions(modelId, enabled) {
  const [watchOptions, setWatchOptions] = useState(null);
  const [loadingWatchOptions, setLoadingWatchOptions] = useState(false);
  const [watchOptionsError, setWatchOptionsError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retryWatchOptions = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !modelId) {
      setWatchOptions(null);
      setWatchOptionsError(null);
      setLoadingWatchOptions(false);
      return;
    }

    let cancelled = false;
    setWatchOptions(null);
    setLoadingWatchOptions(true);
    setWatchOptionsError(null);

    apiClient
      .get(`/models/${modelId}/watch-options`)
      .then((res) => {
        if (!cancelled) {
          setWatchOptions(res.data || null);
          setWatchOptionsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching watch options:', err);
          setWatchOptions(null);
          setWatchOptionsError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWatchOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId, enabled, reloadToken]);

  return {
    watchOptions,
    loadingWatchOptions,
    watchOptionsError,
    retryWatchOptions,
  };
}
