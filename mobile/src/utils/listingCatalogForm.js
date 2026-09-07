export function isSmartwatchCategory(category) {
  return category?.slug === 'smartwatches';
}

export function isSmartwatchListing(listing) {
  return isSmartwatchCategory({
    slug: listing?.category_slug || listing?.category_slug || listing?.category?.slug,
  });
}

export function sameCatalogId(a, b) {
  if (a === undefined || a === null || a === '' || b === undefined || b === null || b === '') {
    return false;
  }
  return String(a) === String(b);
}

export function emptyModelDependentFields() {
  return {
    model_storage_id: '',
    model_color_id: '',
    model_watch_case_size_id: '',
    model_watch_connectivity_id: '',
  };
}

export function connectivityLabel(option, language) {
  if (!option) return '';
  if (language === 'ar' && option.name_ar) return option.name_ar;
  return option.name_en || option.slug || '';
}

export function colorLabel(option) {
  if (!option) return '';
  return option.display_name || option.name || '';
}

export function optionById(options, id) {
  return (options || []).find((item) => sameCatalogId(item.id, id)) || null;
}

export function catalogHasOptions(options) {
  return Array.isArray(options) && options.length > 0;
}

export function missingRequiredCatalogSelection(options, selectedId) {
  return catalogHasOptions(options) && !selectedId;
}

/**
 * Catalog watch step 1: a field is required only when that model has options.
 * Empty options means not applicable — never "no options available" as an error.
 */
export function catalogWatchStep1Issue(formData, watchOptions) {
  if (missingRequiredCatalogSelection(watchOptions?.sizes, formData?.model_watch_case_size_id)) {
    return 'pleaseSelectCaseSize';
  }
  if (
    missingRequiredCatalogSelection(
      watchOptions?.connectivities,
      formData?.model_watch_connectivity_id
    )
  ) {
    return 'pleaseSelectConnectivity';
  }
  if (missingRequiredCatalogSelection(watchOptions?.storages, formData?.model_storage_id)) {
    return 'pleaseSelectStorage';
  }
  return null;
}

export function catalogWatchColorIssue(formData, watchOptions) {
  if (missingRequiredCatalogSelection(watchOptions?.colors, formData?.model_color_id)) {
    return 'pleaseSelectColor';
  }
  return null;
}

/**
 * Drop stale watch filter values without auto-selecting a single storage option.
 * A lone storage value would silently narrow search results, so filters hide it instead.
 */
export function reconcileWatchFilterFields(prev, watchOptions) {
  const sizes = watchOptions?.sizes || [];
  const conns = watchOptions?.connectivities || [];
  const storages = watchOptions?.storages || [];
  const colors = watchOptions?.colors || [];

  const next = { ...prev };

  if (
    prev.model_watch_case_size_id &&
    !sizes.some((item) => sameCatalogId(item.id, prev.model_watch_case_size_id))
  ) {
    next.model_watch_case_size_id = '';
  }

  if (
    prev.model_watch_connectivity_id &&
    !conns.some((item) => sameCatalogId(item.id, prev.model_watch_connectivity_id))
  ) {
    next.model_watch_connectivity_id = '';
  }

  if (storages.length <= 1) {
    next.model_storage_id = '';
  } else if (
    prev.model_storage_id &&
    !storages.some((item) => sameCatalogId(item.id, prev.model_storage_id))
  ) {
    next.model_storage_id = '';
  }

  if (
    prev.model_color_id &&
    !colors.some((item) => sameCatalogId(item.id, prev.model_color_id))
  ) {
    next.model_color_id = '';
  }

  if (
    next.model_watch_case_size_id === prev.model_watch_case_size_id &&
    next.model_watch_connectivity_id === prev.model_watch_connectivity_id &&
    next.model_storage_id === prev.model_storage_id &&
    next.model_color_id === prev.model_color_id
  ) {
    return prev;
  }

  return next;
}

/**
 * Drop stale model-dependent values and auto-select a single storage option.
 */
export function reconcileWatchFormFields(prev, watchOptions) {
  const sizes = watchOptions?.sizes || [];
  const conns = watchOptions?.connectivities || [];
  const storages = watchOptions?.storages || [];
  const colors = watchOptions?.colors || [];

  const next = { ...prev };

  if (
    prev.model_watch_case_size_id &&
    !sizes.some((item) => sameCatalogId(item.id, prev.model_watch_case_size_id))
  ) {
    next.model_watch_case_size_id = '';
  }

  if (
    prev.model_watch_connectivity_id &&
    !conns.some((item) => sameCatalogId(item.id, prev.model_watch_connectivity_id))
  ) {
    next.model_watch_connectivity_id = '';
  }

  if (storages.length === 0) {
    next.model_storage_id = '';
  } else if (storages.length === 1) {
    next.model_storage_id = storages[0].id;
  } else if (
    prev.model_storage_id &&
    !storages.some((item) => sameCatalogId(item.id, prev.model_storage_id))
  ) {
    next.model_storage_id = '';
  }

  if (
    prev.model_color_id &&
    !colors.some((item) => sameCatalogId(item.id, prev.model_color_id))
  ) {
    next.model_color_id = '';
  }

  if (
    next.model_watch_case_size_id === prev.model_watch_case_size_id &&
    next.model_watch_connectivity_id === prev.model_watch_connectivity_id &&
    next.model_storage_id === prev.model_storage_id &&
    next.model_color_id === prev.model_color_id
  ) {
    return prev;
  }

  return next;
}

export const OTHER_BRAND_ID = '__other__';

export function emptyCustomFields() {
  return {
    custom_brand_name: '',
    custom_model_name: '',
    custom_storage: '',
    custom_color_name: '',
    custom_sim_configuration: '',
    custom_case_size: '',
    custom_connectivity: '',
  };
}

export function buildCustomPayload(formData, { categoryId, isSmartwatch } = {}) {
  const payload = {
    listing_source: 'custom',
    category_id: categoryId,
    custom_brand_name: String(formData.custom_brand_name || '').trim(),
    custom_model_name: String(formData.custom_model_name || '').trim(),
    custom_color_name: String(formData.custom_color_name || '').trim(),
  };
  if (isSmartwatch) {
    payload.custom_case_size = String(formData.custom_case_size || '').trim();
    payload.custom_connectivity = String(formData.custom_connectivity || '').trim();
    const storage = String(formData.custom_storage || '').trim();
    if (storage) payload.custom_storage = storage;
  } else {
    payload.custom_storage = String(formData.custom_storage || '').trim();
    payload.custom_sim_configuration = String(formData.custom_sim_configuration || '').trim();
  }
  return payload;
}

function assignCatalogFkIfSelected(payload, key, options, selectedId) {
  if (catalogHasOptions(options) && selectedId) {
    payload[key] = selectedId;
  }
}

export function buildCatalogPayload(formData, { isSmartwatch, watchOptions } = {}) {
  if (isSmartwatch) {
    const payload = {
      listing_source: 'catalog',
      model_id: formData.model_id,
    };
    assignCatalogFkIfSelected(
      payload,
      'model_watch_case_size_id',
      watchOptions?.sizes,
      formData.model_watch_case_size_id
    );
    assignCatalogFkIfSelected(
      payload,
      'model_watch_connectivity_id',
      watchOptions?.connectivities,
      formData.model_watch_connectivity_id
    );
    assignCatalogFkIfSelected(
      payload,
      'model_color_id',
      watchOptions?.colors,
      formData.model_color_id
    );
    assignCatalogFkIfSelected(
      payload,
      'model_storage_id',
      watchOptions?.storages,
      formData.model_storage_id
    );
    return payload;
  }

  return {
    listing_source: 'catalog',
    model_id: formData.model_id,
    model_storage_id: formData.model_storage_id,
    model_color_id: formData.model_color_id,
    sim_configuration_id: formData.sim_configuration_id,
  };
}
