import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../utils/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../../utils/rtlStyles';
import {
  EMPTY_MARKETPLACE_FILTERS,
  emptyWatchMarketplaceFilters,
  emptyModelMarketplaceFilters,
  validateMarketplaceFilters,
  localizedPlaceName,
} from '../../utils/marketplaceFilters';
import { useWatchOptions } from '../../hooks/useWatchOptions';
import { localizeConditionName } from '../../utils/listingCondition';
import {
  isSmartwatchCategory,
  emptyModelDependentFields,
  connectivityLabel,
  colorLabel,
  optionById,
  reconcileWatchFilterFields,
} from '../../utils/listingCatalogForm';
import { fonts, radii, space } from '../../utils/designTokens';
import { SearchablePickerSheet, SelectField } from '../../components/ui';

function storageOptionLabel(item) {
  if (!item) return '';
  return item.label || (item.capacity_gb ? `${item.capacity_gb} GB` : '');
}

function sortBrands(brandsList) {
  return [...brandsList].sort((a, b) => {
    if (a.name.toLowerCase() === 'apple') return -1;
    if (b.name.toLowerCase() === 'apple') return 1;
    if (a.name.toLowerCase() === 'samsung') return -1;
    if (b.name.toLowerCase() === 'samsung') return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function MarketplaceFiltersSheet({
  visible,
  appliedFilters,
  brands,
  categories,
  conditions,
  cities,
  onClose,
  onApply,
}) {
  const { colors } = useTheme();
  const { language, t, isRTL } = useLanguage();
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_MARKETPLACE_FILTERS });
  const [activeFilterSheet, setActiveFilterSheet] = useState(null);
  const [filterBrands, setFilterBrands] = useState([]);
  const [filterModels, setFilterModels] = useState([]);
  const [modelStorages, setModelStorages] = useState([]);
  const [modelColors, setModelColors] = useState([]);
  const [areas, setAreas] = useState([]);

  const draftCategory = categories.find(
    (c) => String(c.id) === String(draftFilters.category_id)
  );
  const isSmartwatchDraft = isSmartwatchCategory(draftCategory);
  const {
    watchOptions,
    loadingWatchOptions,
    watchOptionsError,
    retryWatchOptions,
  } = useWatchOptions(
    draftFilters.model_id,
    isSmartwatchDraft && !!draftFilters.model_id
  );
  const watchSizes = watchOptions?.sizes || [];
  const watchConnectivities = watchOptions?.connectivities || [];
  const watchStorages = watchOptions?.storages || [];
  const watchColors = watchOptions?.colors || [];
  const showWatchStorageFilter =
    !loadingWatchOptions && !watchOptionsError && watchStorages.length > 1;
  const showWatchColorFilter =
    !loadingWatchOptions && !watchOptionsError && watchColors.length > 0;

  const hydrateDraftFilterOptions = async (nextFilters) => {
    try {
      if (nextFilters.category_id) {
        const res = await apiClient.get(`/brands?category_id=${nextFilters.category_id}`);
        setFilterBrands(sortBrands(res.data.brands || []));
      } else {
        setFilterBrands(sortBrands(brands));
      }
      if (nextFilters.brand_id) {
        const url = nextFilters.category_id
          ? `/brands/${nextFilters.brand_id}/models?category_id=${nextFilters.category_id}`
          : `/brands/${nextFilters.brand_id}/models`;
        const res = await apiClient.get(url);
        setFilterModels(res.data.models || []);
      } else {
        setFilterModels([]);
      }
      if (nextFilters.model_id) {
        const cat = categories.find(
          (c) => String(c.id) === String(nextFilters.category_id)
        );
        if (isSmartwatchCategory(cat)) {
          setModelStorages([]);
          setModelColors([]);
        } else {
          const [storagesRes, colorsRes] = await Promise.all([
            apiClient.get(`/models/${nextFilters.model_id}/storages`),
            apiClient.get(`/models/${nextFilters.model_id}/colors`),
          ]);
          setModelStorages(storagesRes.data.storages || storagesRes.data || []);
          setModelColors(colorsRes.data.colors || colorsRes.data || []);
        }
      } else {
        setModelStorages([]);
        setModelColors([]);
      }
      if (nextFilters.city_id) {
        const res = await apiClient.get(`/cities/${nextFilters.city_id}/areas`);
        setAreas(res.data.areas || []);
      } else {
        setAreas([]);
      }
    } catch (e) {
      // Draft UI can still open; options may be empty until reselected.
    }
  };

  useEffect(() => {
    if (!visible) return;
    const next = { ...appliedFilters };
    setDraftFilters(next);
    hydrateDraftFilterOptions(next);
    // Initialize draft from applied filters only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!isSmartwatchDraft || loadingWatchOptions || !watchOptions) return;
    setDraftFilters((prev) => reconcileWatchFilterFields(prev, watchOptions));
  }, [isSmartwatchDraft, loadingWatchOptions, watchOptions]);

  const handleSelectCategory = async (cat_id) => {
    setActiveFilterSheet(null);
    setDraftFilters(prev => ({
      ...prev,
      category_id: cat_id,
      brand_id: '',
      ...emptyModelMarketplaceFilters(),
      min_battery: '',
      max_battery: '',
    }));
    setFilterModels([]);
    setModelStorages([]);
    setModelColors([]);
    try {
      const url = cat_id ? `/brands?category_id=${cat_id}` : '/brands';
      const res = await apiClient.get(url);
      setFilterBrands(sortBrands(res.data.brands || []));
    } catch (e) {
      if (!cat_id) setFilterBrands(sortBrands(brands));
    }
  };

  const handleSelectBrand = async (brand_id) => {
    const currentCategoryId = draftFilters.category_id;
    setActiveFilterSheet(null);
    setDraftFilters(prev => ({
      ...prev,
      brand_id,
      ...emptyModelMarketplaceFilters(),
    }));
    setFilterModels([]);
    setModelStorages([]);
    setModelColors([]);
    if (brand_id) {
      try {
        const url = currentCategoryId
          ? `/brands/${brand_id}/models?category_id=${currentCategoryId}`
          : `/brands/${brand_id}/models`;
        const res = await apiClient.get(url);
        setFilterModels(res.data.models || []);
      } catch (e) {
        // leave filterModels empty
      }
    }
  };

  const handleSelectModel = async (model_id) => {
    const isWatch = isSmartwatchCategory(
      categories.find((c) => String(c.id) === String(draftFilters.category_id))
    );
    setActiveFilterSheet(null);
    setDraftFilters(prev => ({
      ...prev,
      model_id,
      ...emptyModelDependentFields(),
    }));
    setModelStorages([]);
    setModelColors([]);
    if (model_id && !isWatch) {
      try {
        const [storagesRes, colorsRes] = await Promise.all([
          apiClient.get(`/models/${model_id}/storages`),
          apiClient.get(`/models/${model_id}/colors`),
        ]);
        setModelStorages(storagesRes.data.storages || storagesRes.data || []);
        setModelColors(colorsRes.data.colors || colorsRes.data || []);
      } catch (e) {
        // leave empty
      }
    }
  };

  const handleSelectCity = async (city_id) => {
    setDraftFilters(prev => ({ ...prev, city_id, area_id: '' }));
    setAreas([]);
    if (city_id) {
      try {
        const res = await apiClient.get(`/cities/${city_id}/areas`);
        setAreas(res.data.areas || []);
      } catch (e) {
        // leave empty
      }
    }
  };

  const handleCancelFilters = () => {
    setActiveFilterSheet(null);
    onClose();
  };

  const handleApplyFilters = () => {
    const error = validateMarketplaceFilters(draftFilters);
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }
    let next = { ...draftFilters };
    if (!isSmartwatchDraft) {
      next = { ...next, ...emptyWatchMarketplaceFilters() };
    } else if (watchOptions && (watchOptions.storages || []).length <= 1) {
      next = { ...next, model_storage_id: '' };
    }
    setActiveFilterSheet(null);
    onApply(next);
    onClose();
  };

  const handleClearDraftFilters = () => {
    const cleared = { ...EMPTY_MARKETPLACE_FILTERS };
    setDraftFilters(cleared);
    setFilterBrands(sortBrands(brands));
    setFilterModels([]);
    setModelStorages([]);
    setModelColors([]);
    setAreas([]);
    onApply(cleared);
  };

  return (
    <>
      {/* Filter Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={
          activeFilterSheet
            ? () => setActiveFilterSheet(null)
            : handleCancelFilters
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.modalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.filterTitle')}</Text>
              <TouchableOpacity
                onPress={handleCancelFilters}
                style={styles.filterCloseButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.structuredFilterStack}>
                <View>
                  <Text
                    style={[
                      styles.structuredFilterLabel,
                      { color: colors.textSecondary },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('home.category') || 'Category'}
                  </Text>
                  <View style={[styles.filterCategoryRow, getFlexDirection(isRTL, 'row')]}>
                    {categories.map((cat) => {
                      const id = String(cat.id);
                      const selected = draftFilters.category_id === id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.filterCategoryCard,
                            {
                              backgroundColor: selected ? colors.primary : colors.card,
                              borderColor: selected ? colors.primary : colors.inputBorder,
                            },
                          ]}
                          onPress={() => handleSelectCategory(selected ? '' : id)}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name={cat.slug === 'smartwatches' ? 'watch-outline' : 'phone-portrait-outline'}
                            size={24}
                            color={selected ? '#ffffff' : colors.primary}
                          />
                          <Text
                            style={[
                              styles.filterCategoryText,
                              { color: selected ? '#ffffff' : colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {language === 'ar'
                              ? cat.name_ar || cat.name_en || cat.name
                              : cat.name_en || cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {draftFilters.category_id ? (
                    <TouchableOpacity
                      onPress={() => handleSelectCategory('')}
                      style={styles.clearCategoryButton}
                    >
                      <Text style={[styles.clearCategoryText, { color: colors.primary }]}>
                        {t('home.clearCategory') || 'Clear category'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <SelectField
                  label={t('home.brand')}
                  value={
                    filterBrands.find((item) => String(item.id) === draftFilters.brand_id)?.name
                  }
                  placeholder={t('home.selectBrand') || 'Select brand'}
                  onPress={() => setActiveFilterSheet('brand')}
                />
                {isSmartwatchDraft ? (
                  <>
                    {draftFilters.brand_id ? (
                      <SelectField
                        label={t('home.model') || 'Model'}
                        value={
                          filterModels.find((item) => String(item.id) === draftFilters.model_id)?.name
                        }
                        placeholder={t('home.selectModel') || 'Select model'}
                        onPress={() => setActiveFilterSheet('model')}
                      />
                    ) : null}
                    {draftFilters.model_id ? (
                      <>
                        {watchOptionsError ? (
                          <View>
                            <Text
                              style={[
                                styles.filterHelperText,
                                { color: colors.error },
                                getTextAlign(isRTL, 'auto'),
                              ]}
                            >
                              {t('home.watchOptionsLoadFailed')}
                            </Text>
                            <TouchableOpacity onPress={retryWatchOptions} hitSlop={8}>
                              <Text
                                style={[
                                  styles.filterHelperText,
                                  { color: colors.primary },
                                  getTextAlign(isRTL, 'auto'),
                                ]}
                              >
                                {t('common.retry') || 'Try Again'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                        <SelectField
                          label={t('home.caseSize')}
                          value={
                            loadingWatchOptions
                              ? t('common.loading') || 'Loading...'
                              : optionById(watchSizes, draftFilters.model_watch_case_size_id)?.label
                          }
                          placeholder={
                            loadingWatchOptions
                              ? t('common.loading') || 'Loading...'
                              : watchOptionsError
                                ? t('home.selectCaseSize')
                                : watchSizes.length === 0
                                  ? t('home.noCaseSizeOptions')
                                  : t('home.selectCaseSize')
                          }
                          onPress={() =>
                            !loadingWatchOptions &&
                            !watchOptionsError &&
                            watchSizes.length > 0 &&
                            setActiveFilterSheet('caseSize')
                          }
                          disabled={
                            loadingWatchOptions ||
                            !!watchOptionsError ||
                            watchSizes.length === 0
                          }
                        />
                        <SelectField
                          label={t('home.connectivity')}
                          value={
                            loadingWatchOptions
                              ? t('common.loading') || 'Loading...'
                              : connectivityLabel(
                                  optionById(
                                    watchConnectivities,
                                    draftFilters.model_watch_connectivity_id
                                  ),
                                  language
                                )
                          }
                          placeholder={
                            loadingWatchOptions
                              ? t('common.loading') || 'Loading...'
                              : watchOptionsError
                                ? t('home.selectConnectivity')
                                : watchConnectivities.length === 0
                                  ? t('home.noConnectivityOptions')
                                  : t('home.selectConnectivity')
                          }
                          onPress={() =>
                            !loadingWatchOptions &&
                            !watchOptionsError &&
                            watchConnectivities.length > 0 &&
                            setActiveFilterSheet('connectivity')
                          }
                          disabled={
                            loadingWatchOptions ||
                            !!watchOptionsError ||
                            watchConnectivities.length === 0
                          }
                        />
                        {showWatchStorageFilter ? (
                          <SelectField
                            label={t('home.storage') || 'Storage'}
                            value={storageOptionLabel(
                              optionById(watchStorages, draftFilters.model_storage_id)
                            )}
                            placeholder={t('home.selectStorage') || 'Select storage'}
                            onPress={() => setActiveFilterSheet('storage')}
                          />
                        ) : null}
                      </>
                    ) : null}
                    <SelectField
                      label={t('home.condition')}
                      value={localizeConditionName(
                        conditions.find(
                          (option) => String(option.id) === draftFilters.condition_id
                        )?.name,
                        t
                      )}
                      placeholder={t('home.selectCondition') || 'Select condition'}
                      onPress={() => setActiveFilterSheet('condition')}
                    />
                    {draftFilters.model_id && showWatchColorFilter ? (
                      <SelectField
                        label={t('home.colorFinish')}
                        value={colorLabel(
                          optionById(watchColors, draftFilters.model_color_id)
                        )}
                        placeholder={t('home.selectColorFinish')}
                        onPress={() => setActiveFilterSheet('color')}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <SelectField
                      label={t('home.model') || 'Model'}
                      value={
                        filterModels.find((item) => String(item.id) === draftFilters.model_id)?.name
                      }
                      placeholder={
                        draftFilters.brand_id
                          ? t('home.selectModel') || 'Select model'
                          : t('home.selectBrandFirst') || 'Select brand first'
                      }
                      onPress={() => setActiveFilterSheet('model')}
                      disabled={!draftFilters.brand_id}
                    />
                    <SelectField
                      label={t('home.storage') || 'Storage'}
                      value={storageOptionLabel(
                        modelStorages.find(
                          (option) => String(option.id) === draftFilters.model_storage_id
                        )
                      )}
                      placeholder={
                        draftFilters.model_id
                          ? t('home.selectStorage') || 'Select storage'
                          : t('home.selectModelFirst') || 'Select model first'
                      }
                      onPress={() => setActiveFilterSheet('storage')}
                      disabled={!draftFilters.model_id || modelStorages.length === 0}
                    />
                    <SelectField
                      label={t('home.condition')}
                      value={localizeConditionName(
                        conditions.find(
                          (option) => String(option.id) === draftFilters.condition_id
                        )?.name,
                        t
                      )}
                      placeholder={t('home.selectCondition') || 'Select condition'}
                      onPress={() => setActiveFilterSheet('condition')}
                    />
                    <SelectField
                      label={t('home.color') || 'Color'}
                      value={(() => {
                        const item = modelColors.find(
                          (option) => String(option.id) === draftFilters.model_color_id
                        );
                        return item?.display_name || item?.name || '';
                      })()}
                      placeholder={
                        draftFilters.model_id
                          ? t('home.selectColor') || 'Select color'
                          : t('home.selectModelFirst') || 'Select model first'
                      }
                      onPress={() => setActiveFilterSheet('color')}
                      disabled={!draftFilters.model_id || modelColors.length === 0}
                    />
                  </>
                )}
              </View>

              {/* Price Range Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.filterLabelRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.priceRange')}</Text>
                  {(draftFilters.min_price || draftFilters.max_price) && (
                    <TouchableOpacity
                      onPress={() => setDraftFilters(prev => ({ ...prev, min_price: '', max_price: '' }))}
                      style={styles.priceClearButton}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.priceInputContainer, getFlexDirection(isRTL, 'row')]}>
                  <View style={styles.priceInputWrapper}>
                    <Text style={[styles.priceInputLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('home.min')}</Text>
                    <TextInput
                      style={[styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'auto')]}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftFilters.min_price}
                      onChangeText={(text) => setDraftFilters(prev => ({ ...prev, min_price: text }))}
                    />
                  </View>
                  <Text style={[styles.priceSeparator, { color: colors.textSecondary }]}>-</Text>
                  <View style={styles.priceInputWrapper}>
                    <Text style={[styles.priceInputLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('home.max')}</Text>
                    <TextInput
                      style={[styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'auto')]}
                      placeholder={t('home.noLimit')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftFilters.max_price}
                      onChangeText={(text) => setDraftFilters(prev => ({ ...prev, max_price: text }))}
                    />
                  </View>
                </View>
              </View>

              {/* Battery Filter — phones and smartwatches */}
              {(() => {
                const selectedCat = categories.find(c => c.id.toString() === draftFilters.category_id);
                if (
                  !selectedCat ||
                  (selectedCat.slug !== 'phones' && selectedCat.slug !== 'smartwatches')
                ) {
                  return null;
                }
                return (
                  <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                    <View style={[styles.filterLabelRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                        {t('home.batteryHealth') || 'Battery Health (%)'}
                      </Text>
                      {(draftFilters.min_battery || draftFilters.max_battery) && (
                        <TouchableOpacity
                          onPress={() => setDraftFilters(prev => ({ ...prev, min_battery: '', max_battery: '' }))}
                          style={styles.priceClearButton}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={[styles.priceInputContainer, getFlexDirection(isRTL, 'row')]}>
                      <View style={styles.priceInputWrapper}>
                        <Text style={[styles.priceInputLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                          {t('home.minBattery') || 'Min %'}
                        </Text>
                        <TextInput
                          style={[styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'auto')]}
                          placeholder="0"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="numeric"
                          value={draftFilters.min_battery}
                          onChangeText={(text) => setDraftFilters(prev => ({ ...prev, min_battery: text }))}
                        />
                      </View>
                      <Text style={[styles.priceSeparator, { color: colors.textSecondary }]}>-</Text>
                      <View style={styles.priceInputWrapper}>
                        <Text style={[styles.priceInputLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                          {t('home.maxBattery') || 'Max %'}
                        </Text>
                        <TextInput
                          style={[styles.priceInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'auto')]}
                          placeholder="100"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="numeric"
                          value={draftFilters.max_battery}
                          onChangeText={(text) => setDraftFilters(prev => ({ ...prev, max_battery: text }))}
                        />
                      </View>
                    </View>
                  </View>
                );
              })()}

              <View style={styles.locationFields}>
                <SelectField
                  label={t('home.location') || 'Location'}
                  value={(() => {
                    const item = cities.find(
                      (option) => String(option.id) === draftFilters.city_id
                    );
                    return item ? localizedPlaceName(item, language) : '';
                  })()}
                  placeholder={t('home.selectCity') || 'Select city'}
                  onPress={() => setActiveFilterSheet('city')}
                />
                <SelectField
                  label={t('home.area') || 'Area'}
                  value={(() => {
                    const item = areas.find(
                      (option) => String(option.id) === draftFilters.area_id
                    );
                    return item ? localizedPlaceName(item, language) : '';
                  })()}
                  placeholder={
                    draftFilters.city_id
                      ? t('home.selectArea') || 'Select area'
                      : t('home.selectCityFirst') || 'Select city first'
                  }
                  onPress={() => setActiveFilterSheet('area')}
                  disabled={!draftFilters.city_id || areas.length === 0}
                />
              </View>

              {/* Sort Filter */}
              <View style={styles.sortSection}>
                <Text style={[styles.structuredFilterLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                  {t('home.sort') || 'Sort'}
                </Text>
                <View style={[styles.sortGrid, getFlexDirection(isRTL, 'row')]}>
                  {[
                    { value: 'newest', label: t('home.newest') || 'Newest' },
                    { value: 'oldest', label: t('home.oldest') || 'Oldest' },
                    { value: 'price_asc', label: t('home.lowestPrice') || 'Lowest Price' },
                    { value: 'price_desc', label: t('home.highestPrice') || 'Highest Price' },
                  ].map((opt) => {
                    const selected = draftFilters.sort === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.sortOption,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.surfaceContainerLow,
                          },
                        ]}
                        onPress={() =>
                          setDraftFilters((prev) => ({ ...prev, sort: opt.value }))
                        }
                      >
                        <Text
                          style={[
                            styles.sortOptionText,
                            { color: selected ? '#ffffff' : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View
              style={[
                styles.filterActions,
                { backgroundColor: colors.surface },
                getFlexDirection(isRTL, 'row'),
              ]}
            >
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearDraftFilters}
              >
                <Text style={[styles.clearButtonText, { color: colors.primary }, getTextAlign(isRTL, 'center')]}>{t('home.clearAll')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: colors.primary }]}
                onPress={handleApplyFilters}
              >
                <Text style={[styles.applyButtonText, getTextAlign(isRTL, 'center')]}>{t('home.applyFilters')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SearchablePickerSheet
        open={activeFilterSheet === 'brand'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.brand')}
        options={[
          { id: '', label: t('home.anyBrand') || 'Any brand' },
          ...filterBrands.map((item) => ({ id: String(item.id), label: item.name })),
        ]}
        selectedId={draftFilters.brand_id}
        onSelect={(item) => handleSelectBrand(String(item.id))}
        searchPlaceholder={t('home.searchBrands') || 'Search brands'}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'model'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.model') || 'Model'}
        options={[
          { id: '', label: t('home.anyModel') || 'Any model' },
          ...filterModels.map((item) => ({ id: String(item.id), label: item.name })),
        ]}
        selectedId={draftFilters.model_id}
        onSelect={(item) => handleSelectModel(String(item.id))}
        searchPlaceholder={t('home.searchModels') || 'Search models'}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'storage'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.storage') || 'Storage'}
        options={[
          { id: '', label: t('home.anyStorage') || 'Any storage' },
          ...(isSmartwatchDraft ? watchStorages : modelStorages).map((item) => ({
            id: String(item.id),
            label: storageOptionLabel(item) || String(item.id),
          })),
        ]}
        selectedId={draftFilters.model_storage_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({
            ...prev,
            model_storage_id: String(item.id),
          }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'condition'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.condition')}
        options={[
          { id: '', label: t('home.anyCondition') || 'Any condition' },
          ...conditions.map((item) => ({
            id: String(item.id),
            label: localizeConditionName(item.name, t),
          })),
        ]}
        selectedId={draftFilters.condition_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({ ...prev, condition_id: String(item.id) }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'color'}
        onClose={() => setActiveFilterSheet(null)}
        title={isSmartwatchDraft ? t('home.colorFinish') : (t('home.color') || 'Color')}
        options={[
          { id: '', label: t('home.anyColor') || 'Any color' },
          ...(isSmartwatchDraft ? watchColors : modelColors).map((item) => ({
            id: String(item.id),
            label: colorLabel(item),
          })),
        ]}
        selectedId={draftFilters.model_color_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({ ...prev, model_color_id: String(item.id) }))
        }
        searchable={(isSmartwatchDraft ? watchColors : modelColors).length > 8}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'caseSize'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.caseSize')}
        options={[
          { id: '', label: t('home.anyCaseSize') },
          ...watchSizes.map((item) => ({
            id: String(item.id),
            label: item.label || '',
          })),
        ]}
        selectedId={draftFilters.model_watch_case_size_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({
            ...prev,
            model_watch_case_size_id: String(item.id),
          }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'connectivity'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.connectivity')}
        options={[
          { id: '', label: t('home.anyConnectivity') },
          ...watchConnectivities.map((item) => ({
            id: String(item.id),
            label: connectivityLabel(item, language),
          })),
        ]}
        selectedId={draftFilters.model_watch_connectivity_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({
            ...prev,
            model_watch_connectivity_id: String(item.id),
          }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'city'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.location') || 'Location'}
        options={[
          { id: '', label: t('home.anyCity') || 'Any city' },
          ...cities.map((item) => ({
            id: String(item.id),
            label: localizedPlaceName(item, language),
          })),
        ]}
        selectedId={draftFilters.city_id}
        onSelect={(item) => handleSelectCity(String(item.id))}
        searchPlaceholder={t('home.searchCities') || 'Search cities'}
      />
      <SearchablePickerSheet
        open={activeFilterSheet === 'area'}
        onClose={() => setActiveFilterSheet(null)}
        title={t('home.area') || 'Area'}
        options={[
          { id: '', label: t('home.anyArea') || 'Any area' },
          ...areas.map((item) => ({
            id: String(item.id),
            label: localizedPlaceName(item, language),
          })),
        ]}
        selectedId={draftFilters.area_id}
        onSelect={(item) =>
          setDraftFilters((prev) => ({ ...prev, area_id: String(item.id) }))
        }
        searchPlaceholder={t('home.searchAreas') || 'Search areas'}
      />
    </>
  );

}

const styles = StyleSheet.create({
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 28, 28, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '94%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: space[5],
    paddingRight: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    color: '#1a1c1c',
  },
  filterScroll: {
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: space[5],
    paddingBottom: space[6],
  },
  filterCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structuredFilterStack: {
    gap: space[4],
  },
  structuredFilterLabel: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  filterCategoryRow: {
    gap: space[3],
  },
  filterCategoryCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[2],
  },
  filterCategoryText: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    textAlign: 'center',
  },
  clearCategoryButton: {
    alignSelf: 'flex-start',
    paddingTop: space[2],
    minHeight: 36,
    justifyContent: 'center',
  },
  clearCategoryText: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
  },
  filterHelperText: {
    fontFamily: fonts.label,
    fontSize: 13,
    marginTop: 2,
  },
  locationFields: {
    gap: space[4],
    marginTop: space[4],
  },
  sortSection: {
    marginTop: space[4],
  },
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space[2],
  },
  sortOption: {
    width: '48.5%',
    minHeight: 44,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  sortOptionText: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
  },
  filterSection: {
    paddingVertical: space[4],
    borderBottomWidth: 0,
  },
  filterLabel: {
    fontFamily: fonts.label,
    fontSize: 16,
    color: '#1a1c1c',
    marginBottom: space[3],
  },
  filterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceClearButton: {
    padding: 4,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: '#71717a',
    marginBottom: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: 'rgba(193, 198, 212, 0.2)',
    borderRadius: radii.xl,
    minHeight: 48,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#1a1c1c',
    backgroundColor: '#f8fafc',
  },
  priceSeparator: {
    fontSize: 18,
    color: '#71717a',
    marginTop: 20,
  },
  filterActions: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[6],
    gap: space[3],
    borderTopWidth: 0,
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
  },
  clearButton: {
    flex: 0.8,
    minHeight: 52,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
    color: '#71717a',
  },
  applyButton: {
    flex: 1.2,
    minHeight: 52,
    paddingHorizontal: space[4],
    borderRadius: radii.xl,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
    color: '#ffffff',
  },

});
