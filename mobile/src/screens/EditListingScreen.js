import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { useModelOptions } from '../hooks/useModelOptions';
import { filterMvpCategories, localizedCategoryName } from '../utils/mvpCategories';
import {
  LISTING_IMAGE_PICKER_OPTIONS,
  normalizeListingImageAsset,
  appendListingImagesToFormData,
} from '../utils/listingImages';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { API_BASE_URL, resolveMediaUrl } from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;
const MAX_IMAGES = 10;

const isRemoteImageUri = (uri) =>
  typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'));

export default function EditListingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { listingId } = route.params;
  const { colors, isDarkMode } = useTheme();
  const { language, isArabic, isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  // Mixed list: existing remote URLs + newly picked local file:// URIs
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    model_id: '',
    model_storage_id: '',
    model_color_id: '',
    sim_configuration_id: '',
    condition_id: '',
    battery_percentage: null,
    price: '',
    description: '',
    location: '',
    city_id: '',
    area_id: '',
  });

  // Generate battery percentage options from 100% to 70%
  const batteryOptions = Array.from({ length: 31 }, (_, i) => 100 - i);
  const batteryScrollRef = useRef(null);
  const [batteryScrollOffset, setBatteryScrollOffset] = useState(0);
  const isScrollingProgrammatically = useRef(false);
  const [isBatteryPickerExpanded, setIsBatteryPickerExpanded] = useState(false);

  // Refs for form fields to enable focusing
  const priceInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  // Model-specific storages/colors — loaded from the catalog API via shared hook
  const { modelStorages, modelColors, loadingModelOptions } = useModelOptions(formData.model_id);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [simConfigurations, setSimConfigurations] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  // When true, the next model_id change is a prefill from the existing listing —
  // do not reset model_storage_id / model_color_id in that case.
  const prefillActiveRef = useRef(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedBrandId && selectedCategoryId) {
      fetchModels(selectedBrandId);
    } else if (!selectedBrandId) {
      setModels([]);
    }
  }, [selectedBrandId, selectedCategoryId]);

  // Check if battery percentage should be shown (only if condition is not "New")
  const selectedCondition = conditions.find(c => c.id === formData.condition_id);
  const shouldShowBatteryPercentage = selectedCondition && selectedCondition.name !== 'New';

  // Reset battery picker when condition changes to "New"
  useEffect(() => {
    if (selectedCondition && selectedCondition.name === 'New') {
      setFormData(prev => ({ ...prev, battery_percentage: null }));
      setIsBatteryPickerExpanded(false);
    }
  }, [formData.condition_id]);

  const calculateScrollOffset = (itemIndex) => {
    const topPadding = ITEM_HEIGHT * 2;
    const visibleCenterY = VISIBLE_ITEMS * ITEM_HEIGHT / 2;
    const itemCenterInContent = topPadding + (itemIndex * ITEM_HEIGHT) + (ITEM_HEIGHT / 2);
    const offset = itemCenterInContent - visibleCenterY;
    const maxOffset = (topPadding + ((batteryOptions.length - 1) * ITEM_HEIGHT) + ITEM_HEIGHT / 2) - visibleCenterY;
    return Math.max(0, Math.min(offset, maxOffset));
  };

  const findCenteredItem = (offsetY) => {
    const itemIndex = Math.round(offsetY / ITEM_HEIGHT);
    return Math.max(0, Math.min(itemIndex, batteryOptions.length - 1));
  };

  // Scroll to selected battery percentage when picker is expanded
  useEffect(() => {
    if (isBatteryPickerExpanded && formData.battery_percentage !== null && batteryScrollRef.current && !isScrollingProgrammatically.current) {
      const selectedIndex = batteryOptions.findIndex(p => p === formData.battery_percentage);
      if (selectedIndex >= 0) {
        const finalOffset = calculateScrollOffset(selectedIndex);
        isScrollingProgrammatically.current = true;
        setTimeout(() => {
          if (batteryScrollRef.current) {
            batteryScrollRef.current.scrollTo({ y: finalOffset, animated: false });
            setBatteryScrollOffset(finalOffset);
            setTimeout(() => {
              isScrollingProgrammatically.current = false;
            }, 300);
          }
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatteryPickerExpanded]);

  const handleScrollEnd = (offsetY) => {
    if (isScrollingProgrammatically.current) {
      isScrollingProgrammatically.current = false;
      return;
    }

    const centeredIndex = findCenteredItem(offsetY);
    const targetOffset = calculateScrollOffset(centeredIndex);
    const selectedValue = batteryOptions[centeredIndex];

    if (Math.abs(offsetY - targetOffset) > 1) {
      setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));

      isScrollingProgrammatically.current = true;
      if (batteryScrollRef.current) {
        batteryScrollRef.current.scrollTo({ y: targetOffset, animated: true });
        setBatteryScrollOffset(targetOffset);
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 500);
      }
    } else {
      setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));
    }
  };

  const fetchData = async () => {
    try {
      // Pending/hidden/declined listings are owner-only. Without the token the
      // API returns 404 for those statuses, which breaks Edit Listing.
      const token = await AsyncStorage.getItem('authToken');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const [categoriesRes, conditionsRes, simRes, citiesRes, listingRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/categories`),
        axios.get(`${API_BASE_URL}/conditions`),
        axios.get(`${API_BASE_URL}/sim-configurations`),
        axios.get(`${API_BASE_URL}/cities`),
        axios.get(`${API_BASE_URL}/listings/${listingId}`, { headers: authHeaders }),
      ]);

      setConditions(conditionsRes.data.conditions);
      setSimConfigurations(simRes.data.sim_configurations || []);
      setCities(citiesRes.data.cities || []);

      const cats = filterMvpCategories(categoriesRes.data.categories || []);
      setCategories(cats);

      const listing = listingRes.data.listing;
      if (listing) {
        prefillActiveRef.current = true;
        setFormData({
          model_id: listing.model_id || '',
          model_storage_id: listing.model_storage_id || '',
          model_color_id: listing.model_color_id || '',
          sim_configuration_id: listing.sim_configuration_id || '',
          condition_id: listing.condition_id || '',
          battery_percentage: listing.battery_percentage ?? null,
          price: listing.price !== undefined && listing.price !== null ? String(listing.price) : '',
          description: listing.description_en || listing.description_ar || listing.description || '',
          location: listing.location || '',
          city_id: listing.city_id || '',
          area_id: listing.area_id || '',
        });
        if (listing.city_id) {
          try {
            const areasRes = await axios.get(`${API_BASE_URL}/cities/${listing.city_id}/areas`);
            setAreas(areasRes.data.areas || []);
          } catch (e) {
            setAreas([]);
          }
        }
        const existingImages = (listingRes.data.images || [])
          .map((img) => resolveMediaUrl(img.image_url))
          .filter(Boolean);
        setImages(existingImages);

        const listingCategoryId =
          listing.category_id ||
          (cats.find(c => c.slug === 'phones') || cats[0])?.id ||
          null;
        if (listingCategoryId) {
          setSelectedCategoryId(listingCategoryId);
          await fetchBrandsForCategory(listingCategoryId);
        }
        if (listing.brand_id) {
          setSelectedBrandId(listing.brand_id);
        }
      } else {
        const phonesCat = cats.find(c => c.slug === 'phones') || cats[0];
        if (phonesCat) {
          setSelectedCategoryId(phonesCat.id);
          await fetchBrandsForCategory(phonesCat.id);
        }
      }
    } catch (error) {
      console.error('Error fetching listing for edit:', error);
      Alert.alert('Error', t('editListing.loadFailed'));
    } finally {
      setFetching(false);
    }
  };

  const fetchBrandsForCategory = async (categoryId) => {
    try {
      const url = categoryId
        ? `${API_BASE_URL}/brands?category_id=${categoryId}`
        : `${API_BASE_URL}/brands`;
      const brandsRes = await axios.get(url);
      setBrands(brandsRes.data.brands || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
    }
  };

  const handleSelectCategory = async (categoryId) => {
    if (categoryId === selectedCategoryId) return;
    setSelectedCategoryId(categoryId);
    setSelectedBrandId(null);
    setModels([]);
    setModelSearchQuery('');
    setFormData(prev => ({
      ...prev,
      model_id: '',
      model_storage_id: '',
      model_color_id: '',
    }));
    await fetchBrandsForCategory(categoryId);
  };

  const handleSelectCity = async (cityId) => {
    setFormData(prev => ({ ...prev, city_id: cityId, area_id: '', location: '' }));
    setAreas([]);
    if (!cityId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/cities/${cityId}/areas`);
      setAreas(res.data.areas || []);
      const city = cities.find(c => c.id === cityId);
      if (city) {
        setFormData(prev => ({
          ...prev,
          city_id: cityId,
          location: language === 'ar' && city.name_ar ? city.name_ar : city.name_en,
        }));
      }
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };

  const handleSelectArea = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    const city = cities.find(c => c.id === formData.city_id);
    const areaName = area
      ? (language === 'ar' && area.name_ar ? area.name_ar : area.name_en)
      : '';
    const cityName = city
      ? (language === 'ar' && city.name_ar ? city.name_ar : city.name_en)
      : '';
    setFormData(prev => ({
      ...prev,
      area_id: areaId,
      location: areaName && cityName ? `${areaName}, ${cityName}` : (cityName || prev.location),
    }));
  };

  const fetchModels = async (brandId) => {
    try {
      const params = selectedCategoryId ? `?category_id=${selectedCategoryId}` : '';
      const modelsRes = await axios.get(`${API_BASE_URL}/brands/${brandId}/models${params}`);
      setModels(modelsRes.data.models);
    } catch (error) {
      console.error('Error fetching models:', error);
      Alert.alert('Error', 'Failed to load models');
    }
  };

  // When the model changes, reset storage and color selections —
  // unless this change originated from the initial prefill of the existing listing.
  // The hook (useModelOptions) handles the actual data fetch.
  useEffect(() => {
    if (!formData.model_id) {
      setFormData(prev => ({ ...prev, model_storage_id: '', model_color_id: '' }));
      return;
    }
    if (prefillActiveRef.current) {
      prefillActiveRef.current = false; // consumed — next change is user-initiated
      return;
    }
    setFormData(prev => ({ ...prev, model_storage_id: '', model_color_id: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.model_id]);

  const handleBrandSelect = (brandId) => {
    // Any manual brand change clears the prefill guard.
    prefillActiveRef.current = false;
    // Only clear the model/storage/color selection when the user actively changes the brand.
    if (brandId !== selectedBrandId) {
      setFormData(prev => ({ ...prev, model_id: '', model_storage_id: '', model_color_id: '' }));
    }
    setSelectedBrandId(brandId);
    setModelSearchQuery('');
  };

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  // Store field positions for scrolling
  const [fieldPositions, setFieldPositions] = useState({});

  const handleFieldLayout = (fieldName, event) => {
    const { y } = event.nativeEvent.layout;
    setFieldPositions(prev => ({ ...prev, [fieldName]: y }));
  };

  const scrollToField = (fieldName) => {
    const position = fieldPositions[fieldName];
    if (position !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: position - 20, animated: true });
    }
  };

  const requestImagePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestImagePermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync(LISTING_IMAGE_PICKER_OPTIONS);

      if (!result.canceled && result.assets) {
        const normalized = [];
        for (let i = 0; i < result.assets.length; i += 1) {
          const part = await normalizeListingImageAsset(result.assets[i], i);
          normalized.push(part.uri);
        }
        setImages(prev => [...prev, ...normalized].slice(0, MAX_IMAGES));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation mirrors CreateListingScreen for consistency.
    if (!selectedCategoryId) {
      Alert.alert('Error', t('createListing.pleaseSelectCategory') || 'Please select a category');
      return;
    }

    if (!selectedBrandId) {
      Alert.alert('Error', 'Please select a brand');
      scrollToField('brand');
      return;
    }

    if (!formData.model_id) {
      Alert.alert('Error', 'Please select a model');
      scrollToField('model');
      return;
    }

    if (!formData.model_storage_id) {
      Alert.alert('Error', 'Please select a storage capacity');
      scrollToField('storage');
      return;
    }

    if (!formData.model_color_id) {
      Alert.alert('Error', 'Please select a color');
      scrollToField('color');
      return;
    }

    if (!formData.sim_configuration_id) {
      Alert.alert('Error', 'Please select a SIM configuration');
      scrollToField('sim');
      return;
    }

    if (!formData.condition_id) {
      Alert.alert('Error', 'Please select a condition');
      scrollToField('condition');
      return;
    }

    if (selectedCondition && selectedCondition.name !== 'New' && !formData.battery_percentage) {
      Alert.alert('Error', 'Please select battery percentage');
      return;
    }

    if (!formData.price || formData.price.trim() === '') {
      Alert.alert('Error', 'Please enter a price');
      scrollToField('price');
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 300);
      return;
    }

    const priceValue = Number(formData.price);
    if (!Number.isFinite(priceValue) || priceValue < 0.01) {
      Alert.alert('Error', 'Please enter a valid price greater than 0');
      scrollToField('price');
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 300);
      return;
    }

    if (!formData.city_id) {
      Alert.alert('Error', 'Please select a city');
      scrollToField('location');
      return;
    }

    if (!images || images.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      scrollToField('images');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Keep existing remote URLs; upload any newly picked local images.
      const newLocalUris = images.filter((uri) => !isRemoteImageUri(uri));

      let uploadedUrls = [];
      if (newLocalUris.length > 0) {
        const uploadFormData = new FormData();
        await appendListingImagesToFormData(uploadFormData, newLocalUris);

        const uploadResponse = await axios.post(
          `${API_BASE_URL}/upload/listing-images`,
          uploadFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        uploadedUrls = uploadResponse.data.image_urls || [];
      }

      // Final ordered list: kept remotes in their current positions, new uploads appended
      // (same visual order as the picker: remotes and locals mixed as shown).
      // Rebuild by walking the images array and replacing locals with uploaded URLs in order.
      let uploadIndex = 0;
      const finalImageUrls = images.map((uri) => {
        if (isRemoteImageUri(uri)) return resolveMediaUrl(uri);
        const uploaded = uploadedUrls[uploadIndex];
        uploadIndex += 1;
        return uploaded;
      }).filter(Boolean);

      await axios.put(
        `${API_BASE_URL}/listings/${listingId}`,
        {
          ...formData,
          price: parseFloat(formData.price),
          city_id: formData.city_id || null,
          area_id: formData.area_id || null,
          images: finalImageUrls,
          description_en: language === 'en' ? formData.description || null : null,
          description_ar: language === 'ar' ? formData.description || null : null,
          description_ar_is_auto_translated: false,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert(t('common.success'), t('editListing.listingUpdated'), [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error updating listing:', error);
      logApiError('EditListingScreen.updateListing', error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('editListing.updateFailed'))
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('editListing.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.category') || t('home.category')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.pickerOption,
                    {
                      backgroundColor: selectedCategoryId === cat.id ? colors.primary : colors.surface,
                      borderColor: selectedCategoryId === cat.id ? colors.primary : colors.inputBorder,
                    },
                  ]}
                  onPress={() => handleSelectCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: selectedCategoryId === cat.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {localizedCategoryName(cat, language)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('brand', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.brand')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {brands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.pickerOption,
                    {
                      backgroundColor: selectedBrandId === brand.id ? colors.primary : colors.surface,
                      borderColor: selectedBrandId === brand.id ? colors.primary : colors.inputBorder
                    },
                  ]}
                  onPress={() => handleBrandSelect(brand.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: selectedBrandId === brand.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {brand.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedBrandId && (
            <View
              style={styles.inputGroup}
              onLayout={(e) => handleFieldLayout('model', e)}
            >
              <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                {t('createListing.model')} <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.searchBox, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={[styles.searchIcon, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }, getTextAlign(isRTL, 'left')]}
                  placeholder={t('createListing.searchModels') || "Search models..."}
                  placeholderTextColor={colors.textSecondary}
                  value={modelSearchQuery}
                  onChangeText={setModelSearchQuery}
                />
                {modelSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setModelSearchQuery('')} style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {filteredModels.length > 0 ? (
                <ScrollView
                  style={styles.modelsScrollView}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
                    {filteredModels.map((model) => (
                      <TouchableOpacity
                        key={model.id}
                        style={[
                          styles.pickerOption,
                          {
                            backgroundColor: formData.model_id === model.id ? colors.primary : colors.surface,
                            borderColor: formData.model_id === model.id ? colors.primary : colors.inputBorder
                          },
                        ]}
                        onPress={() => setFormData({ ...formData, model_id: model.id })}
                      >
                        <View style={[styles.modelOptionContent, getFlexDirection(isRTL, 'row')]}>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              { color: formData.model_id === model.id ? '#ffffff' : colors.text },
                              getTextAlign(isRTL, 'auto'),
                            ]}
                          >
                            {model.name}
                          </Text>
                          {model.release_year && (
                            <Text
                              style={[
                                styles.modelYear,
                                { color: formData.model_id === model.id ? '#ffffff' : colors.textSecondary },
                                getTextAlign(isRTL, 'auto'),
                                { marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }
                              ]}
                            >
                              {model.release_year}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: colors.inputBackground }]}>
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    {modelSearchQuery ? 'No models found' : 'Select a brand first'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('storage', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.storage')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            {!formData.model_id ? (
              <Text style={[styles.placeholderNote, { color: colors.textSecondary }]}>
                {t('createListing.selectModelFirst') || 'Select a model first'}
              </Text>
            ) : loadingModelOptions ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : modelStorages.length === 0 ? (
              <Text style={[styles.placeholderNote, { color: colors.textSecondary }]}>
                {t('createListing.noStorageOptions') || 'No storage options available'}
              </Text>
            ) : (
              <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
                {modelStorages.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.pickerOption,
                      { backgroundColor: formData.model_storage_id === item.id ? colors.primary : colors.surface, borderColor: formData.model_storage_id === item.id ? colors.primary : colors.inputBorder },
                    ]}
                    onPress={() => setFormData({ ...formData, model_storage_id: item.id })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: formData.model_storage_id === item.id ? '#ffffff' : colors.text },
                        getTextAlign(isRTL, 'center'),
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('condition', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.condition')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition.id}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: formData.condition_id === condition.id ? colors.primary : colors.surface, borderColor: formData.condition_id === condition.id ? colors.primary : colors.inputBorder },
                  ]}
                  onPress={() => {
                    if (condition.name === 'New') {
                      setFormData(prev => ({ ...prev, condition_id: condition.id, battery_percentage: null }));
                      setIsBatteryPickerExpanded(false);
                    } else {
                      setFormData({ ...formData, condition_id: condition.id });
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: formData.condition_id === condition.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {(() => {
                      const conditionKey = condition.name?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                      const conditionMap = {
                        'new': t('conditions.new'),
                        'likenew': t('conditions.likeNew'),
                        'usedlikenew': t('conditions.usedlikenew'),
                        'usedgood': t('conditions.usedgood'),
                        'usedfair': t('conditions.usedfair'),
                        'excellent': t('conditions.excellent'),
                        'verygood': t('conditions.veryGood'),
                        'good': t('conditions.good'),
                        'fair': t('conditions.fair'),
                        'poor': t('conditions.poor'),
                        'used': t('conditions.used'),
                        'refurbished': t('conditions.refurbished'),
                      };
                      return conditionMap[conditionKey] || condition.name || '';
                    })()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {shouldShowBatteryPercentage && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                {t('createListing.batteryPercentage')} <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              {!isBatteryPickerExpanded ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsBatteryPickerExpanded(true)}
                  style={[
                    styles.batteryCollapsedView,
                    { backgroundColor: colors.surface, borderColor: colors.inputBorder },
                    getFlexDirection(isRTL, 'row'),
                  ]}
                >
                  <Text style={[styles.batteryCollapsedText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {formData.battery_percentage !== null ? `${formData.battery_percentage}%` : t('createListing.pleaseSelectBattery')}
                  </Text>
                  <Ionicons name={isRTL ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }} />
                </TouchableOpacity>
              ) : (
                <View>
                  <View style={[styles.wheelPickerContainer, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}>
                    <View style={styles.wheelPickerWrapper}>
                      <ScrollView
                        ref={batteryScrollRef}
                        showsVerticalScrollIndicator={false}
                        decelerationRate={0.9}
                        bounces={false}
                        scrollEventThrottle={16}
                        onScroll={(event) => {
                          if (!isScrollingProgrammatically.current) {
                            const offsetY = event.nativeEvent.contentOffset.y;
                            setBatteryScrollOffset(offsetY);
                            const centeredIndex = findCenteredItem(offsetY);
                            const selectedValue = batteryOptions[centeredIndex];
                            if (formData.battery_percentage !== selectedValue) {
                              setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));
                            }
                          }
                        }}
                        onScrollEndDrag={(event) => handleScrollEnd(event.nativeEvent.contentOffset.y)}
                        onMomentumScrollEnd={(event) => {
                          if (isScrollingProgrammatically.current) {
                            isScrollingProgrammatically.current = false;
                            return;
                          }
                          handleScrollEnd(event.nativeEvent.contentOffset.y);
                        }}
                        contentContainerStyle={styles.wheelPickerContent}
                        style={styles.wheelPickerScroll}
                        nestedScrollEnabled={true}
                      >
                        <View style={{ height: ITEM_HEIGHT * 2 }} />
                        {batteryOptions.map((percent, index) => {
                          const topPadding = ITEM_HEIGHT * 2;
                          const visibleCenterY = VISIBLE_ITEMS * ITEM_HEIGHT / 2;
                          const itemTopInContent = topPadding + (index * ITEM_HEIGHT);
                          const itemCenterInContent = itemTopInContent + (ITEM_HEIGHT / 2);
                          const contentYAtVisibleCenter = batteryScrollOffset + visibleCenterY;
                          const distanceFromCenter = Math.abs(contentYAtVisibleCenter - itemCenterInContent);
                          const normalizedDistance = Math.min(distanceFromCenter / ITEM_HEIGHT, 1.5);
                          const isSelected = formData.battery_percentage === percent;
                          const scale = isSelected ? 1 : Math.max(1 - normalizedDistance * 0.12, 0.85);
                          const opacity = isSelected ? 1 : (isScrollingProgrammatically.current ? 0.7 : Math.max(1 - normalizedDistance * 0.25, 0.6));

                          return (
                            <View
                              key={percent}
                              style={{
                                height: ITEM_HEIGHT,
                                width: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                  setFormData(prev => ({ ...prev, battery_percentage: percent }));
                                  const finalOffset = calculateScrollOffset(index);
                                  isScrollingProgrammatically.current = true;
                                  if (batteryScrollRef.current) {
                                    batteryScrollRef.current.scrollTo({ y: finalOffset, animated: true });
                                    setBatteryScrollOffset(finalOffset);
                                    setTimeout(() => {
                                      isScrollingProgrammatically.current = false;
                                    }, 400);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  height: ITEM_HEIGHT,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  transform: [{ scale }],
                                  opacity: opacity,
                                  backgroundColor: isSelected ? colors.primary : 'transparent',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Text
                                  style={{
                                    color: isSelected ? '#ffffff' : colors.text,
                                    fontSize: isSelected ? 20 : 16,
                                    fontWeight: isSelected ? '600' : '400',
                                    textAlign: 'center',
                                  }}
                                >
                                  {percent}%
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                        <View style={{ height: ITEM_HEIGHT * 2 }} />
                      </ScrollView>
                      <View style={styles.wheelPickerIndicator} pointerEvents="none">
                        <View
                          style={[
                            styles.indicatorLine,
                            {
                              backgroundColor: colors.inputBorder || colors.textSecondary || '#cccccc',
                              top: (VISIBLE_ITEMS * ITEM_HEIGHT / 2) - (ITEM_HEIGHT / 2) - 1,
                              width: '90%',
                              height: 1.5,
                            }
                          ]}
                        />
                        <View
                          style={[
                            styles.indicatorLine,
                            {
                              backgroundColor: colors.inputBorder || colors.textSecondary || '#cccccc',
                              top: (VISIBLE_ITEMS * ITEM_HEIGHT / 2) + (ITEM_HEIGHT / 2) + 1,
                              width: '90%',
                              height: 1.5,
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsBatteryPickerExpanded(false)}
                    style={[styles.doneButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('color', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.color')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            {!formData.model_id ? (
              <Text style={[styles.placeholderNote, { color: colors.textSecondary }]}>
                {t('createListing.selectModelFirst') || 'Select a model first'}
              </Text>
            ) : loadingModelOptions ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : modelColors.length === 0 ? (
              <Text style={[styles.placeholderNote, { color: colors.textSecondary }]}>
                {t('createListing.noColorOptions') || 'No color options available'}
              </Text>
            ) : (
              <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
                {modelColors.map((color) => (
                  <TouchableOpacity
                    key={color.id}
                    style={[
                      styles.pickerOption,
                      {
                        backgroundColor: formData.model_color_id === color.id ? colors.primary : colors.surface,
                        borderColor: formData.model_color_id === color.id ? colors.primary : colors.inputBorder
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, model_color_id: color.id })}
                  >
                    <View style={[styles.colorOption, getFlexDirection(isRTL, 'row')]}>
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color.hex_code || '#cccccc' },
                          { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                        ]}
                      />
                      <Text
                        style={[
                          styles.pickerOptionText,
                          { color: formData.model_color_id === color.id ? '#ffffff' : colors.text },
                          getTextAlign(isRTL, 'auto'),
                        ]}
                      >
                        {color.display_name || color.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('sim', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.simConfiguration')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {simConfigurations.map((sim) => (
                <TouchableOpacity
                  key={sim.id}
                  style={[
                    styles.pickerOption,
                    {
                      backgroundColor: formData.sim_configuration_id === sim.id ? colors.primary : colors.surface,
                      borderColor: formData.sim_configuration_id === sim.id ? colors.primary : colors.inputBorder,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, sim_configuration_id: sim.id })}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: formData.sim_configuration_id === sim.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {sim.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('price', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.price')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              ref={priceInputRef}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'left')]}
              placeholder={t('createListing.enterPrice')}
              placeholderTextColor={colors.textSecondary}
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('createListing.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, getTextAlign(isRTL, 'left')]}
              placeholder={language === 'ar' ? t('createListing.describePhoneAr') : t('createListing.describePhone')}
              placeholderTextColor={colors.textSecondary}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('location', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.location')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary, fontSize: 14, marginBottom: 8 }, getTextAlign(isRTL, 'auto')]}>
              {t('home.city') || 'City'}
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city.id}
                  style={[
                    styles.pickerOption,
                    {
                      backgroundColor: formData.city_id === city.id ? colors.primary : colors.surface,
                      borderColor: formData.city_id === city.id ? colors.primary : colors.inputBorder,
                    },
                  ]}
                  onPress={() => handleSelectCity(city.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: formData.city_id === city.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {language === 'ar' && city.name_ar ? city.name_ar : city.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formData.city_id ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, fontSize: 14, marginTop: 12, marginBottom: 8 }, getTextAlign(isRTL, 'auto')]}>
                  {t('home.area') || 'Area'}
                </Text>
                {areas.length === 0 ? (
                  <Text style={[{ color: colors.textSecondary, fontSize: 14 }, getTextAlign(isRTL, 'auto')]}>
                    {language === 'ar' ? 'لا توجد مناطق لهذه المدينة' : 'No areas listed for this city'}
                  </Text>
                ) : (
                  <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
                    {areas.map((area) => (
                      <TouchableOpacity
                        key={area.id}
                        style={[
                          styles.pickerOption,
                          {
                            backgroundColor: formData.area_id === area.id ? colors.primary : colors.surface,
                            borderColor: formData.area_id === area.id ? colors.primary : colors.inputBorder,
                          },
                        ]}
                        onPress={() => handleSelectArea(area.id)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: formData.area_id === area.id ? '#ffffff' : colors.text },
                            getTextAlign(isRTL, 'center'),
                          ]}
                        >
                          {language === 'ar' && area.name_ar ? area.name_ar : area.name_en}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </View>

          <View
            style={styles.inputGroup}
            onLayout={(e) => handleFieldLayout('images', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.images')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <Text style={[styles.imageHint, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('createListing.addUpTo10Images')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageScroll}
              contentContainerStyle={isRTL ? { flexDirection: 'row-reverse' } : {}}
            >
              {images.map((uri, index) => (
                <View key={`${uri}-${index}`} style={[styles.imageContainer, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                  <Image source={{ uri: resolveMediaUrl(uri) }} style={[styles.imagePreview, { backgroundColor: colors.inputBackground }]} />
                  <TouchableOpacity
                    style={[styles.removeImageButton, { backgroundColor: colors.surface }, { right: isRTL ? 'auto' : -8, left: isRTL ? -8 : 'auto' }]}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity
                  style={[
                    styles.addImageButton,
                    {
                      borderColor: colors.inputBorder,
                      backgroundColor: colors.inputBackground
                    }
                  ]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera-outline" size={32} color={colors.primary} />
                  <Text style={[styles.addImageText, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('createListing.addImage')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('editListing.saveChanges')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderNote: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageHint: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 12,
  },
  imageScroll: {
    marginVertical: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    marginTop: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  modelsScrollView: {
    maxHeight: 300,
    marginTop: 8,
  },
  modelOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modelYear: {
    fontSize: 12,
    marginLeft: 8,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 14,
  },
  wheelPickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
    width: '100%',
  },
  wheelPickerWrapper: {
    flex: 1,
    position: 'relative',
  },
  wheelPickerScroll: {
    flex: 1,
  },
  wheelPickerContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  wheelPickerIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  indicatorLine: {
    width: '80%',
    height: 1,
    position: 'absolute',
    left: '10%',
  },
  batteryCollapsedView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
  },
  batteryCollapsedText: {
    fontSize: 16,
    fontWeight: '500',
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
