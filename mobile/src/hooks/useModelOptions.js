import { useState, useEffect } from 'react';
import apiClient from '../utils/api';

/**
 * Fetches the officially-supported storage capacities and colors for a given model.
 *
 * - Re-fetches automatically whenever `modelId` changes.
 * - Cancels any in-flight request when `modelId` changes or the component unmounts,
 *   preventing stale responses from overwriting newer state.
 * - Returns empty arrays when `modelId` is falsy or on request failure.
 *
 * @param {number|string|''} modelId - The model's database ID (falsy → idle state).
 * @returns {{ modelStorages: object[], modelColors: object[], loadingModelOptions: boolean }}
 */
export function useModelOptions(modelId) {
  const [modelStorages, setModelStorages] = useState([]);
  const [modelColors, setModelColors] = useState([]);
  const [loadingModelOptions, setLoadingModelOptions] = useState(false);

  useEffect(() => {
    if (!modelId) {
      setModelStorages([]);
      setModelColors([]);
      return;
    }

    let cancelled = false;
    setLoadingModelOptions(true);

    Promise.all([
      apiClient.get(`/models/${modelId}/storages`),
      apiClient.get(`/models/${modelId}/colors`),
    ])
      .then(([storagesRes, colorsRes]) => {
        if (!cancelled) {
          setModelStorages(storagesRes.data.storages || []);
          setModelColors(colorsRes.data.colors || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching model options:', err);
          setModelStorages([]);
          setModelColors([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModelOptions(false);
      });

    return () => { cancelled = true; };
  }, [modelId]);

  return { modelStorages, modelColors, loadingModelOptions };
}
