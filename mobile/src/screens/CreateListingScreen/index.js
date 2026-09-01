import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../../utils/authSession';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../../utils/rtlStyles';
import { useModelOptions } from '../../hooks/useModelOptions';
import { useWatchOptions } from '../../hooks/useWatchOptions';
import { filterMvpCategories, localizedCategoryName } from '../../utils/mvpCategories';
import {
  isSmartwatchCategory,
  emptyModelDependentFields,
  connectivityLabel,
  colorLabel,
  optionById,
  reconcileWatchFormFields,
  buildCatalogPayload,
  OTHER_BRAND_ID,
  emptyCustomFields,
  buildCustomPayload,
} from '../../utils/listingCatalogForm';
import { localizeConditionName } from '../../utils/listingCondition';
import {
  composeListingLocation,
  listingAreaText,
} from '../../utils/marketplaceFilters';
import {
  launchListingImageLibraryAsync,
  mapPickerAssetsToListingImages,
  mergeListingImageAssets,
  appendListingImagesToFormData,
  getListingImagePickerErrorMessage,
} from '../../utils/listingImages';
import { getApiErrorMessage, logApiError } from '../../utils/apiError';
import apiClient, { resolveMediaUrl } from '../../utils/api';
import {
  sanitizeBatteryInput,
  parseBatteryPercentage,
  batteryPercentageToInputValue,
} from '../../utils/batteryPercentage';
import { fonts, radii, space, ambientElevation } from '../../utils/designTokens';
import {
  FormScreenSkeleton,
  SelectField,
  SearchablePickerSheet,
} from '../../components/ui';
import CreateListingHeader from './CreateListingHeader';
import CreateListingImages from './CreateListingImages';

const TOTAL_STEPS = 3;

const isRemoteImageUri = (uri) =>
  typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'));

const getImageUri = (image) =>
  typeof image === 'string' ? image : image?.uri || '';

function categoryIcon(slug) {
  if (slug === 'smartwatches') return 'watch-outline';
  return 'phone-portrait-outline';
}

export default function CreateListingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const listingId = route.params?.listingId;
  const isEditMode = listingId != null;
  const { colors } = useTheme();
  const { language, isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    model_id: '',
    model_storage_id: '',
    model_color_id: '',
    sim_configuration_id: '',
    model_watch_case_size_id: '',
    model_watch_connectivity_id: '',
    custom_brand_name: '',
    custom_model_name: '',
    custom_storage: '',
    custom_color_name: '',
    custom_sim_configuration: '',
    custom_case_size: '',
    custom_connectivity: '',
    condition_id: '',
    battery_percentage: '',
    price: '',
    description: '',
    area: '',
    city_id: '',
  });

  const priceInputRef = useRef(null);
  const batteryInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const isSmartwatch = isSmartwatchCategory(selectedCategory);
  const [conditions, setConditions] = useState([]);
  const [simConfigurations, setSimConfigurations] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const isCustomListing = selectedBrandId === OTHER_BRAND_ID;
  const { modelStorages, modelColors, loadingModelOptions } = useModelOptions(
    isSmartwatch || isCustomListing ? '' : formData.model_id
  );
  const {
    watchOptions,
    loadingWatchOptions,
    watchOptionsError,
    retryWatchOptions,
  } = useWatchOptions(isCustomListing ? '' : formData.model_id, isSmartwatch && !isCustomListing);
  const [step, setStep] = useState(1);
  const [activeSheet, setActiveSheet] = useState(null);
  const prefillActiveRef = useRef(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedBrandId && selectedBrandId !== OTHER_BRAND_ID && selectedCategoryId) {
      fetchModels(selectedBrandId);
    } else {
      setModels([]);
      if (!selectedBrandId) {
        setFormData((prev) => ({ ...prev, model_id: '' }));
      }
    }
  }, [selectedBrandId, selectedCategoryId]);

  useEffect(() => {
    if (!formData.model_id) {
      setFormData((prev) => ({ ...prev, ...emptyModelDependentFields() }));
      return;
    }
    if (isEditMode && prefillActiveRef.current) {
      prefillActiveRef.current = false;
      return;
    }
    setFormData((prev) => ({
      ...prev,
      ...emptyModelDependentFields(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.model_id]);

  useEffect(() => {
    if (!isSmartwatch || loadingWatchOptions || !watchOptions) return;
    setFormData((prev) => reconcileWatchFormFields(prev, watchOptions));
  }, [isSmartwatch, loadingWatchOptions, watchOptions]);

  const selectedCondition = conditions.find((c) => c.id === formData.condition_id);
  const shouldShowBatteryPercentage = selectedCondition && selectedCondition.name !== 'New';

  useEffect(() => {
    if (selectedCondition && selectedCondition.name === 'New') {
      setFormData((prev) => ({ ...prev, battery_percentage: '' }));
    }
  }, [formData.condition_id]);

  const fetchData = async () => {
    try {
      if (isEditMode) {
        const token = await getAuthToken();
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const [categoriesRes, conditionsRes, citiesRes, listingRes] = await Promise.all([
          apiClient.get('/categories'),
          apiClient.get('/conditions'),
          apiClient.get('/cities'),
          apiClient.get(`/listings/${listingId}`, { headers: authHeaders }),
        ]);

        setConditions(conditionsRes.data.conditions);
        setCities(citiesRes.data.cities || []);

        const cats = filterMvpCategories(categoriesRes.data.categories || []);
        setCategories(cats);

        const listing = listingRes.data.listing;
        if (listing) {
          const watchesCat = cats.find((c) => c.slug === 'smartwatches');
          const phonesCat = cats.find((c) => c.slug === 'phones') || cats[0];
          let listingCategoryId =
            listing.category_id ||
            cats.find((c) => c.slug === listing.category_slug)?.id ||
            null;
          if (
            !listingCategoryId &&
            (listing.model_watch_case_size_id || listing.model_watch_connectivity_id)
          ) {
            listingCategoryId = watchesCat?.id || null;
          }
          if (!listingCategoryId) {
            listingCategoryId = phonesCat?.id || null;
          }
          const listingCategory = cats.find((c) => c.id === listingCategoryId);
          const listingIsWatch = isSmartwatchCategory(listingCategory);

          prefillActiveRef.current = true;
          setSelectedCategoryId(listingCategoryId);
          const listingIsCustom = listing.listing_source === 'custom' || !listing.model_id;
          setFormData({
            model_id: listingIsCustom ? '' : (listing.model_id || ''),
            model_storage_id: listingIsCustom ? '' : (listing.model_storage_id || ''),
            model_color_id: listingIsCustom ? '' : (listing.model_color_id || ''),
            sim_configuration_id: listingIsWatch || listingIsCustom ? '' : (listing.sim_configuration_id || ''),
            model_watch_case_size_id: listingIsCustom ? '' : (listing.model_watch_case_size_id || ''),
            model_watch_connectivity_id: listingIsCustom ? '' : (listing.model_watch_connectivity_id || ''),
            custom_brand_name: listingIsCustom ? (listing.custom_brand_name || listing.brand_name || '') : '',
            custom_model_name: listingIsCustom ? (listing.custom_model_name || listing.model_name || '') : '',
            custom_storage: listingIsCustom ? (listing.custom_storage || listing.storage_display || '') : '',
            custom_color_name: listingIsCustom ? (listing.custom_color_name || listing.color_display_name || listing.color_name || '') : '',
            custom_sim_configuration: listingIsCustom ? (listing.custom_sim_configuration || listing.sim_configuration_name || '') : '',
            custom_case_size: listingIsCustom ? (listing.custom_case_size || listing.case_size_label || '') : '',
            custom_connectivity: listingIsCustom ? (listing.custom_connectivity || listing.watch_connectivity_name || '') : '',
            condition_id: listing.condition_id || '',
            battery_percentage: batteryPercentageToInputValue(listing.battery_percentage),
            price: listing.price !== undefined && listing.price !== null ? String(listing.price) : '',
            description: listing.description_en || listing.description_ar || listing.description || '',
            area: listingAreaText(listing, language),
            city_id: listing.city_id || '',
          });
          const existingImages = (listingRes.data.images || [])
            .map((img) => resolveMediaUrl(img.image_url))
            .filter(Boolean)
            .map((uri) => ({ uri }));
          setImages(existingImages);

          if (!listingIsWatch) {
            await fetchSimConfigurations();
          }
          if (listingCategoryId) {
            await fetchBrandsForCategory(listingCategoryId);
          }
          if (listingIsCustom) {
            setSelectedBrandId(OTHER_BRAND_ID);
          } else if (listing.brand_id) {
            setSelectedBrandId(listing.brand_id);
          }
        }
        return;
      }

      const [categoriesRes, conditionsRes, citiesRes] = await Promise.all([
        apiClient.get('/categories'),
        apiClient.get('/conditions'),
        apiClient.get('/cities'),
      ]);

      setConditions(conditionsRes.data.conditions);
      setCities(citiesRes.data.cities || []);
      setCategories(filterMvpCategories(categoriesRes.data.categories || []));
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert(
        'Error',
        isEditMode ? t('editListing.loadFailed') : 'Failed to load form data'
      );
    } finally {
      setFetching(false);
    }
  };

  const fetchSimConfigurations = async () => {
    if (simConfigurations.length > 0) return;
    try {
      const simRes = await apiClient.get('/sim-configurations');
      setSimConfigurations(simRes.data.sim_configurations || []);
    } catch (error) {
      console.error('Error fetching SIM configurations:', error);
    }
  };

  const fetchBrandsForCategory = async (categoryId) => {
    try {
      const url = categoryId
        ? `/brands?category_id=${categoryId}`
        : '/brands';
      const brandsRes = await apiClient.get(url);
      setBrands(brandsRes.data.brands || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
    }
  };

  const handleSelectCategory = async (categoryId) => {
    if (categoryId === selectedCategoryId) return;
    if (isEditMode) {
      prefillActiveRef.current = false;
    }
    setSelectedCategoryId(categoryId);
    setSelectedBrandId(null);
    setModels([]);
    setFormData((prev) => ({
      ...prev,
      model_id: '',
      sim_configuration_id: '',
      ...emptyModelDependentFields(),
      ...emptyCustomFields(),
    }));
    const category = categories.find((c) => c.id === categoryId);
    if (category && !isSmartwatchCategory(category)) {
      await fetchSimConfigurations();
    }
    await fetchBrandsForCategory(categoryId);
  };

  const handleSelectCity = (cityId) => {
    setFormData((prev) => ({ ...prev, city_id: cityId }));
  };

  const fetchModels = async (brandId) => {
    try {
      const params = selectedCategoryId ? `?category_id=${selectedCategoryId}` : '';
      const modelsRes = await apiClient.get(
        `/brands/${brandId}/models${params}`
      );
      setModels(modelsRes.data.models);
    } catch (error) {
      console.error('Error fetching models:', error);
      Alert.alert('Error', 'Failed to load models');
    }
  };

  const handleBrandSelect = (brandId) => {
    if (isEditMode) {
      prefillActiveRef.current = false;
    }
    setSelectedBrandId(brandId);
    const switchingToCustom = brandId === OTHER_BRAND_ID;
    setFormData((prev) => ({
      ...prev,
      model_id: '',
      sim_configuration_id: '',
      ...emptyModelDependentFields(),
      ...(switchingToCustom
        ? emptyCustomFields()
        : emptyCustomFields()),
    }));
  };

  const requestImagePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please grant camera roll permissions to upload images'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    // Request library access so the native PHAsset fallback can resolve
    // photos when NSItemProvider fails on "public.jpeg" (common on Simulator).
    // PHPicker still supports multi-select with allowsEditing: false.
    const hasPermission = await requestImagePermission();
    if (!hasPermission) return;

    try {
      const remainingSlots = Math.max(0, 10 - images.length);
      if (remainingSlots === 0) return;

      // Selection path only:
      // 1) native multi-select Photos picker (no crop sheet)
      // 2) map returned URIs into preview state
      // No FileSystem / ImageManipulator / base64 on this path.
      const result = await launchListingImageLibraryAsync(remainingSlots);

      // Cancel leaves existing photos untouched.
      if (result.canceled) {
        console.info('[listing-images] picker canceled; preview unchanged');
        return;
      }

      if (!result.assets?.length) {
        console.warn('[listing-images] native returned success with zero assets');
        return;
      }

      // Minimal preview binding: use picker URIs directly.
      const selectedAssets = mapPickerAssetsToListingImages(result.assets);
      console.info(
        '[listing-images] binding raw URIs to preview',
        selectedAssets.map((asset) => asset.uri)
      );

      if (selectedAssets.length === 0) {
        Alert.alert(
          'Unable to add photo',
          'The picker returned assets without a usable uri field.'
        );
        return;
      }

      setImages((current) => mergeListingImageAssets(current, selectedAssets, 10));
    } catch (error) {
      // Alert is created HERE.
      // Failing operation is ImagePicker.launchImageLibraryAsync inside
      // launchListingImageLibraryAsync — it rejects before assets/URIs exist.
      console.warn(
        '[listing-images] pickImage catch (no raw URI available to preview)',
        {
          code: error?.code,
          message: error?.message,
        }
      );
      Alert.alert('Unable to add photo', getListingImagePickerErrorMessage(error));
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const moveImage = (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy;
    });
  };

  const goToField = (fieldName) => {
    const FIELD_STEP = {
      brand: 1,
      model: 1,
      storage: 1,
      caseSize: 1,
      connectivity: 1,
      condition: 2,
      color: 2,
      sim: 2,
      price: 3,
      location: 3,
      images: 3,
    };
    const targetStep = FIELD_STEP[fieldName];
    if (targetStep && targetStep !== step) {
      setStep(targetStep);
    }
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!selectedCategoryId) {
        Alert.alert(
          'Error',
          t('createListing.pleaseSelectCategory') || 'Please select a category'
        );
        return false;
      }
      if (!selectedBrandId) {
        Alert.alert('Error', t('createListing.pleaseSelectBrand'));
        return false;
      }
      if (isCustomListing) {
        if (!String(formData.custom_brand_name || '').trim()) {
          Alert.alert('Error', t('createListing.pleaseEnterBrand'));
          return false;
        }
        if (!String(formData.custom_model_name || '').trim()) {
          Alert.alert('Error', t('createListing.pleaseEnterModel'));
          return false;
        }
        if (isSmartwatch) {
          if (!String(formData.custom_case_size || '').trim()) {
            Alert.alert('Error', t('createListing.pleaseEnterCaseSize'));
            return false;
          }
          if (!String(formData.custom_connectivity || '').trim()) {
            Alert.alert('Error', t('createListing.pleaseEnterConnectivity'));
            return false;
          }
          return true;
        }
        if (!String(formData.custom_storage || '').trim()) {
          Alert.alert('Error', t('createListing.pleaseEnterStorage'));
          return false;
        }
        return true;
      }
      if (!formData.model_id) {
        Alert.alert('Error', t('createListing.pleaseSelectModel'));
        return false;
      }
      if (isSmartwatch) {
        if (loadingWatchOptions) {
          Alert.alert('Error', t('createListing.watchOptionsStillLoading'));
          return false;
        }
        if (watchOptionsError || !watchOptions) {
          Alert.alert('Error', t('createListing.watchOptionsLoadFailed'));
          return false;
        }
        if (!(watchOptions.sizes || []).length) {
          Alert.alert('Error', t('createListing.noCaseSizeOptions'));
          return false;
        }
        if (!formData.model_watch_case_size_id) {
          Alert.alert('Error', t('createListing.pleaseSelectCaseSize'));
          return false;
        }
        if (!(watchOptions.connectivities || []).length) {
          Alert.alert('Error', t('createListing.noConnectivityOptions'));
          return false;
        }
        if (!formData.model_watch_connectivity_id) {
          Alert.alert('Error', t('createListing.pleaseSelectConnectivity'));
          return false;
        }
        if ((watchOptions.storages || []).length > 0 && !formData.model_storage_id) {
          Alert.alert('Error', t('createListing.pleaseSelectStorage'));
          return false;
        }
        return true;
      }
      if (!formData.model_storage_id) {
        Alert.alert('Error', t('createListing.pleaseSelectStorage'));
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!formData.condition_id) {
        Alert.alert('Error', t('createListing.pleaseSelectCondition'));
        return false;
      }
      if (selectedCondition && selectedCondition.name !== 'New') {
        const batteryResult = parseBatteryPercentage(formData.battery_percentage);
        if (!batteryResult.ok) {
          Alert.alert(
            'Error',
            batteryResult.reason === 'empty'
              ? t('createListing.pleaseEnterBattery')
              : t('createListing.batteryRangeError')
          );
          setTimeout(() => batteryInputRef.current?.focus(), 300);
          return false;
        }
      }
      if (isCustomListing) {
        if (!String(formData.custom_color_name || '').trim()) {
          Alert.alert('Error', t('createListing.pleaseEnterColor'));
          return false;
        }
        if (!isSmartwatch && !String(formData.custom_sim_configuration || '').trim()) {
          Alert.alert('Error', t('createListing.pleaseEnterSim'));
          return false;
        }
        return true;
      }
      if (!formData.model_color_id) {
        Alert.alert('Error', t('createListing.pleaseSelectColor'));
        return false;
      }
      if (!isSmartwatch && !formData.sim_configuration_id) {
        Alert.alert('Error', t('createListing.pleaseSelectSim') || 'Please select a SIM configuration');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!formData.price || formData.price.trim() === '') {
        Alert.alert('Error', t('createListing.pleaseEnterPrice'));
        return false;
      }
      const priceValue = Number(formData.price);
      if (!Number.isFinite(priceValue) || priceValue < 0.01) {
        Alert.alert('Error', 'Please enter a valid price greater than 0');
        return false;
      }
      if (!formData.city_id) {
        Alert.alert('Error', t('createListing.selectCity') || 'Please select a city');
        return false;
      }
      if (!images || images.length === 0) {
        Alert.alert('Error', t('createListing.pleaseAddAtLeastOneImage'));
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    requestAnimationFrame(() =>
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    );
  };

  const handleBackStep = () => {
    if (step <= 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => s - 1);
    requestAnimationFrame(() =>
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    );
  };

  const handleSubmit = async () => {
    if (!selectedCategoryId) {
      Alert.alert(
        'Error',
        t('createListing.pleaseSelectCategory') || 'Please select a category'
      );
      setStep(1);
      return;
    }
    if (!selectedBrandId) {
      Alert.alert('Error', 'Please select a brand');
      goToField('brand');
      return;
    }
    if (!isCustomListing) {
      if (!formData.model_id) {
        Alert.alert('Error', 'Please select a model');
        goToField('model');
        return;
      }
      if (isSmartwatch) {
        if (loadingWatchOptions) {
          Alert.alert('Error', t('createListing.watchOptionsStillLoading'));
          setStep(1);
          return;
        }
        if (watchOptionsError || !watchOptions) {
          Alert.alert('Error', t('createListing.watchOptionsLoadFailed'));
          setStep(1);
          return;
        }
        if (!formData.model_watch_case_size_id) {
          Alert.alert('Error', t('createListing.pleaseSelectCaseSize'));
          goToField('caseSize');
          return;
        }
        if (!formData.model_watch_connectivity_id) {
          Alert.alert('Error', t('createListing.pleaseSelectConnectivity'));
          goToField('connectivity');
          return;
        }
        if ((watchOptions.storages || []).length > 0 && !formData.model_storage_id) {
          Alert.alert('Error', 'Please select storage');
          goToField('storage');
          return;
        }
      } else if (!formData.model_storage_id) {
        Alert.alert('Error', 'Please select storage');
        goToField('storage');
        return;
      }
      if (!formData.model_color_id) {
        Alert.alert('Error', 'Please select a color');
        goToField('color');
        return;
      }
      if (!isSmartwatch && !formData.sim_configuration_id) {
        Alert.alert('Error', 'Please select a SIM configuration');
        goToField('sim');
        return;
      }
    }
    if (!formData.condition_id) {
      Alert.alert('Error', 'Please select a condition');
      goToField('condition');
      return;
    }

    let batteryPercentageValue = null;
    if (selectedCondition && selectedCondition.name !== 'New') {
      const batteryResult = parseBatteryPercentage(formData.battery_percentage);
      if (!batteryResult.ok) {
        Alert.alert(
          'Error',
          batteryResult.reason === 'empty'
            ? t('createListing.pleaseEnterBattery')
            : t('createListing.batteryRangeError')
        );
        setStep(2);
        setTimeout(() => batteryInputRef.current?.focus(), 300);
        return;
      }
      batteryPercentageValue = batteryResult.value;
    }

    if (!formData.price || formData.price.trim() === '') {
      Alert.alert('Error', 'Please enter a price');
      goToField('price');
      setTimeout(() => priceInputRef.current?.focus(), 300);
      return;
    }

    const priceValue = Number(formData.price);
    if (!Number.isFinite(priceValue) || priceValue < 0.01) {
      Alert.alert('Error', 'Please enter a valid price greater than 0');
      goToField('price');
      setTimeout(() => priceInputRef.current?.focus(), 300);
      return;
    }

    if (!formData.city_id) {
      Alert.alert('Error', 'Please select a city');
      goToField('location');
      return;
    }

    const selectedCity = cities.find((c) => String(c.id) === String(formData.city_id));
    const cityName = selectedCity
      ? language === 'ar' && selectedCity.name_ar
        ? selectedCity.name_ar
        : selectedCity.name_en
      : '';
    const locationFields = {
      city_id: formData.city_id || null,
      area_id: null,
      location: composeListingLocation(formData.area, cityName),
    };

    if (!images || images.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      goToField('images');
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();

      if (isEditMode) {
        const imageUris = images.map(getImageUri).filter(Boolean);
        const newLocalUris = imageUris.filter((uri) => !isRemoteImageUri(uri));

        let uploadedUrls = [];
        if (newLocalUris.length > 0) {
          const uploadFormData = new FormData();
          await appendListingImagesToFormData(uploadFormData, newLocalUris);

          const uploadResponse = await apiClient.post(
            '/upload/listing-images',
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

        let uploadIndex = 0;
        const finalImageUrls = imageUris
          .map((uri) => {
            if (isRemoteImageUri(uri)) return resolveMediaUrl(uri);
            const uploaded = uploadedUrls[uploadIndex];
            uploadIndex += 1;
            return uploaded;
          })
          .filter(Boolean);

        const response = await apiClient.put(
          `/listings/${listingId}`,
          {
            ...(isCustomListing
              ? buildCustomPayload(formData, { categoryId: selectedCategoryId, isSmartwatch })
              : buildCatalogPayload(formData, { isSmartwatch, watchOptions })),
            condition_id: formData.condition_id,
            battery_percentage: batteryPercentageValue,
            price: parseFloat(formData.price),
            ...locationFields,
            description: formData.description || null,
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

        const newId = response.data?.listing?.id;
        const editedId = parseInt(String(listingId), 10);
        Alert.alert(t('common.success'), t('editListing.listingUpdated'), [
          {
            text: 'OK',
            onPress: () => {
              if (newId && Number(newId) !== editedId) {
                navigation.replace('ListingDetails', { listingId: Number(newId) });
              } else {
                navigation.goBack();
              }
            },
          },
        ]);
        return;
      }

      let imageUrls = [];
      if (images.length > 0) {
        const uploadFormData = new FormData();
        await appendListingImagesToFormData(uploadFormData, images);
        const uploadResponse = await apiClient.post(
          '/upload/listing-images',
          uploadFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        imageUrls = uploadResponse.data.image_urls || [];
      }

      const response = await apiClient.post(
        '/listings',
        {
          ...(isCustomListing
            ? buildCustomPayload(formData, { categoryId: selectedCategoryId, isSmartwatch })
            : buildCatalogPayload(formData, { isSmartwatch, watchOptions })),
          condition_id: formData.condition_id,
          battery_percentage: batteryPercentageValue,
          price: parseFloat(formData.price),
          description: formData.description || null,
          ...locationFields,
          images: imageUrls,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdStatus = response.data?.listing?.status;
      const isPending = createdStatus === 'pending';
      Alert.alert(
        isPending ? t('createListing.listingSubmittedTitle') : t('common.success'),
        isPending
          ? t('createListing.listingSubmittedMessage')
          : t('createListing.listingCreated'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      logApiError(
        isEditMode ? 'CreateListingScreen.updateListing' : 'CreateListingScreen.createListing',
        error
      );
      if (isEditMode) {
        const tipId = error?.response?.data?.tip_listing_id;
        Alert.alert(
          t('common.error'),
          tipId
            ? `${getApiErrorMessage(error, t('editListing.updateFailed'))} (latest: #${tipId})`
            : getApiErrorMessage(error, t('editListing.updateFailed'))
        );
      } else {
        Alert.alert(
          t('common.error'),
          getApiErrorMessage(error, t('createListing.createFailed'))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const localizeCondition = (condition) =>
    localizeConditionName(condition?.name, t);

  const watchSizes = watchOptions?.sizes || [];
  const watchConnectivities = watchOptions?.connectivities || [];
  const watchStorages = watchOptions?.storages || [];
  const watchColors = watchOptions?.colors || [];
  const showWatchStorage = isSmartwatch && watchStorages.length > 1;
  const loadingDependentOptions = isSmartwatch ? loadingWatchOptions : loadingModelOptions;

  const selectedBrandLabel = isCustomListing
    ? t('createListing.other')
    : brands.find((b) => b.id === selectedBrandId)?.name || '';
  const selectedModelLabel =
    models.find((m) => String(m.id) === String(formData.model_id))?.name || '';
  const selectedStorageLabel = (() => {
    const item = (isSmartwatch ? watchStorages : modelStorages).find(
      (s) => String(s.id) === String(formData.model_storage_id)
    );
    return item ? item.label || `${item.capacity_gb} GB` : '';
  })();
  const selectedColorLabel = (() => {
    const c = (isSmartwatch ? watchColors : modelColors).find(
      (x) => String(x.id) === String(formData.model_color_id)
    );
    return colorLabel(c);
  })();
  const selectedCaseSizeLabel = optionById(watchSizes, formData.model_watch_case_size_id)?.label || '';
  const selectedConnectivityLabel = connectivityLabel(
    optionById(watchConnectivities, formData.model_watch_connectivity_id),
    language
  );
  const selectedSimLabel =
    simConfigurations.find((s) => s.id === formData.sim_configuration_id)?.name || '';
  const selectedCityLabel = (() => {
    const c = cities.find((x) => x.id === formData.city_id);
    if (!c) return '';
    return language === 'ar' && c.name_ar ? c.name_ar : c.name_en;
  })();

  const brandOptions = useMemo(
    () => brands.map((b) => ({ id: b.id, label: b.name })),
    [brands]
  );
  const modelOptions = useMemo(
    () => models.map((m) => ({ id: m.id, label: m.name })),
    [models]
  );
  const storageOptions = useMemo(
    () =>
      (isSmartwatch ? watchStorages : modelStorages).map((s) => ({
        id: s.id,
        label: s.label || `${s.capacity_gb} GB`,
      })),
    [isSmartwatch, watchStorages, modelStorages]
  );
  const colorOptions = useMemo(
    () =>
      (isSmartwatch ? watchColors : modelColors).map((c) => ({
        id: c.id,
        label: colorLabel(c),
      })),
    [isSmartwatch, watchColors, modelColors]
  );
  const caseSizeOptions = useMemo(
    () => watchSizes.map((s) => ({ id: s.id, label: s.label })),
    [watchSizes]
  );
  const connectivityOptions = useMemo(
    () =>
      watchConnectivities.map((c) => ({
        id: c.id,
        label: connectivityLabel(c, language),
      })),
    [watchConnectivities, language]
  );
  const conditionOptions = useMemo(
    () =>
      conditions.map((c) => ({
        id: c.id,
        label: localizeCondition(c),
        name: c.name,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conditions, language]
  );
  const simOptions = useMemo(
    () => simConfigurations.map((s) => ({ id: s.id, label: s.name })),
    [simConfigurations]
  );
  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        id: c.id,
        label: language === 'ar' && c.name_ar ? c.name_ar : c.name_en,
      })),
    [cities, language]
  );

  if (fetching) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <CreateListingHeader
          onBack={() => navigation.goBack()}
          loading
        />
        <FormScreenSkeleton />
      </SafeAreaView>
    );
  }

  const stepTitle =
    step === 1
      ? t('createListing.heroTitle') || 'What are you selling?'
      : step === 2
        ? t('createListing.detailsTitle') || 'Device details'
        : t('createListing.listingTitle') || 'Finish your listing';

  const stepSubtitle =
    step === 1
      ? t('createListing.heroSubtitle') || 'Select the device you want to list.'
      : step === 2
        ? t('createListing.detailsSubtitle') || 'Tell buyers about the condition and specs.'
        : t('createListing.listingSubtitle') || 'Add price, location, and photos.';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <CreateListingHeader
        step={step}
        totalSteps={TOTAL_STEPS}
        onBack={handleBackStep}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heroTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {stepTitle}
        </Text>
        <Text
          style={[styles.heroSubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
        >
          {stepSubtitle}
        </Text>

        {step === 1 && (
          <View style={styles.stack}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('createListing.category') || 'Category'}
            </Text>
            <View style={[styles.categoryRow, getFlexDirection(isRTL, 'row')]}>
              {categories.map((cat) => {
                const selected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                      ambientElevation,
                    ]}
                    onPress={() => handleSelectCategory(cat.id)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        {
                          backgroundColor: selected
                            ? 'rgba(255,255,255,0.18)'
                            : colors.surfaceContainerLow,
                        },
                      ]}
                    >
                      <Ionicons
                        name={categoryIcon(cat.slug)}
                        size={28}
                        color={selected ? '#ffffff' : colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: selected ? '#ffffff' : colors.text },
                      ]}
                    >
                      {localizedCategoryName(cat, language)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCategoryId ? (
              <>
                <SelectField
                  label={t('createListing.brand')}
                  value={selectedBrandLabel}
                  placeholder={t('createListing.selectBrand') || 'Select a brand'}
                  onPress={() => setActiveSheet('brand')}
                />
                {isCustomListing ? (
                  <>
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      {t('createListing.customDeviceHint')}
                    </Text>
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        {t('createListing.brand')} *
                      </Text>
                      <TextInput
                        style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                        value={formData.custom_brand_name}
                        onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_brand_name: text }))}
                        placeholder={t('createListing.enterBrandName')}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        {t('createListing.model')} *
                      </Text>
                      <TextInput
                        style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                        value={formData.custom_model_name}
                        onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_model_name: text }))}
                        placeholder={t('createListing.enterModelName')}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    {isSmartwatch ? (
                      <>
                        <View>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                            {t('createListing.caseSize')} *
                          </Text>
                          <TextInput
                            style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                            value={formData.custom_case_size}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_case_size: text }))}
                            placeholder={t('createListing.enterCaseSize')}
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                        <View>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                            {t('createListing.connectivity')} *
                          </Text>
                          <TextInput
                            style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                            value={formData.custom_connectivity}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_connectivity: text }))}
                            placeholder={t('createListing.enterConnectivity')}
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                        <View>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                            {t('createListing.storage')}
                          </Text>
                          <TextInput
                            style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                            value={formData.custom_storage}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_storage: text }))}
                            placeholder={t('createListing.enterStorage')}
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      </>
                    ) : (
                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('createListing.storage')} *
                        </Text>
                        <TextInput
                          style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                          value={formData.custom_storage}
                          onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_storage: text }))}
                          placeholder={t('createListing.enterStorage')}
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    )}
                  </>
                ) : (
                  <>
                <SelectField
                  label={t('createListing.model')}
                  value={selectedModelLabel}
                  placeholder={
                    selectedBrandId
                      ? t('createListing.selectModel') || 'Select a model'
                      : t('createListing.selectBrandFirst') || 'Select a brand first'
                  }
                  onPress={() => setActiveSheet('model')}
                  disabled={!selectedBrandId}
                />
                {isSmartwatch ? (
                  <>
                    {formData.model_id && watchOptionsError ? (
                      <View>
                        <Text style={[styles.helperText, { color: colors.error }]}>
                          {t('createListing.watchOptionsLoadFailed')}
                        </Text>
                        <TouchableOpacity onPress={retryWatchOptions} hitSlop={8}>
                          <Text style={[styles.helperText, { color: colors.primary }]}>
                            {t('common.retry') || 'Try Again'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <SelectField
                      label={t('createListing.caseSize')}
                      value={
                        formData.model_id && loadingWatchOptions
                          ? t('common.loading') || 'Loading…'
                          : selectedCaseSizeLabel
                      }
                      placeholder={
                        !formData.model_id
                          ? t('createListing.selectModelFirst') || 'Select a model first'
                          : watchSizes.length === 0 && !loadingWatchOptions
                            ? t('createListing.noCaseSizeOptions')
                            : t('createListing.selectCaseSize')
                      }
                      onPress={() => !loadingWatchOptions && setActiveSheet('caseSize')}
                      disabled={
                        !formData.model_id ||
                        loadingWatchOptions ||
                        !!watchOptionsError ||
                        watchSizes.length === 0
                      }
                    />
                    <SelectField
                      label={t('createListing.connectivity')}
                      value={
                        formData.model_id && loadingWatchOptions
                          ? t('common.loading') || 'Loading…'
                          : selectedConnectivityLabel
                      }
                      placeholder={
                        !formData.model_id
                          ? t('createListing.selectModelFirst') || 'Select a model first'
                          : watchConnectivities.length === 0 && !loadingWatchOptions
                            ? t('createListing.noConnectivityOptions')
                            : t('createListing.selectConnectivity')
                      }
                      onPress={() => !loadingWatchOptions && setActiveSheet('connectivity')}
                      disabled={
                        !formData.model_id ||
                        loadingWatchOptions ||
                        !!watchOptionsError ||
                        watchConnectivities.length === 0
                      }
                    />
                    {showWatchStorage ? (
                      <SelectField
                        label={t('createListing.storage')}
                        value={
                          formData.model_id && loadingWatchOptions
                            ? t('common.loading') || 'Loading…'
                            : selectedStorageLabel
                        }
                        placeholder={t('createListing.selectStorage') || 'Select storage'}
                        onPress={() => !loadingWatchOptions && setActiveSheet('storage')}
                        disabled={!formData.model_id || loadingWatchOptions}
                      />
                    ) : null}
                  </>
                ) : (
                  <SelectField
                    label={t('createListing.storage')}
                    value={
                      formData.model_id && loadingModelOptions
                        ? t('common.loading') || 'Loading…'
                        : selectedStorageLabel
                    }
                    placeholder={
                      formData.model_id
                        ? t('createListing.selectStorage') || 'Select storage'
                        : t('createListing.selectModelFirst') || 'Select a model first'
                    }
                    onPress={() => !loadingModelOptions && setActiveSheet('storage')}
                    disabled={
                      !formData.model_id ||
                      loadingModelOptions ||
                      storageOptions.length === 0
                    }
                  />
                )}
                  </>
                )}
              </>
            ) : null}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stack}>
            <SelectField
              label={t('createListing.condition')}
              value={localizeCondition(selectedCondition)}
              placeholder={t('createListing.selectCondition') || 'Select condition'}
              onPress={() => setActiveSheet('condition')}
            />
            {shouldShowBatteryPercentage ? (
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {t('createListing.batteryPercentage')} *
                </Text>
                <TextInput
                  ref={batteryInputRef}
                  style={[
                    styles.batteryInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                    ambientElevation,
                  ]}
                  value={formData.battery_percentage}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      battery_percentage: sanitizeBatteryInput(text),
                    })
                  }
                  placeholder="70–100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
            {isCustomListing ? (
              <>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {isSmartwatch ? t('createListing.colorFinish') : t('createListing.color')} *
                  </Text>
                  <TextInput
                    style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                    value={formData.custom_color_name}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_color_name: text }))}
                    placeholder={isSmartwatch ? t('createListing.enterColorFinish') : t('createListing.enterColor')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                {!isSmartwatch ? (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('createListing.simConfiguration')} *
                    </Text>
                    <TextInput
                      style={[styles.batteryInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, ambientElevation]}
                      value={formData.custom_sim_configuration}
                      onChangeText={(text) => setFormData((prev) => ({ ...prev, custom_sim_configuration: text }))}
                      placeholder={t('createListing.enterSim')}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <SelectField
                  label={isSmartwatch ? t('createListing.colorFinish') : t('createListing.color')}
                  value={
                    formData.model_id && loadingDependentOptions
                      ? t('common.loading') || 'Loading…'
                      : selectedColorLabel
                  }
                  placeholder={
                    isSmartwatch
                      ? t('createListing.selectColorFinish') || t('createListing.selectColor')
                      : t('createListing.selectColor') || 'Select color'
                  }
                  onPress={() => setActiveSheet('color')}
                  disabled={!formData.model_id || loadingDependentOptions || !!watchOptionsError}
                />
                {!isSmartwatch ? (
                  <SelectField
                    label={t('createListing.simConfiguration')}
                    value={selectedSimLabel}
                    placeholder={t('createListing.selectSim') || 'Select SIM'}
                    onPress={() => setActiveSheet('sim')}
                  />
                ) : null}
              </>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stack}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('createListing.price')}
                <Text style={styles.requiredAsterisk}> *</Text>
              </Text>
              <TextInput
                ref={priceInputRef}
                style={[
                  styles.priceInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                  ambientElevation,
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                keyboardType="decimal-pad"
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('createListing.description')}
              </Text>
              <TextInput
                style={[
                  styles.descriptionInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                  ambientElevation,
                ]}
                placeholder={t('createListing.describePhone')}
                placeholderTextColor={colors.textMuted}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                textAlignVertical="top"
              />
            </View>

            <SelectField
              label={t('home.city') || 'City'}
              required
              value={selectedCityLabel}
              placeholder={t('createListing.selectCity') || 'Select city'}
              onPress={() => setActiveSheet('city')}
            />
            <View>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('home.area') || 'Area'}
              </Text>
              <TextInput
                style={[
                  styles.batteryInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                  ambientElevation,
                  getTextAlign(isRTL, 'auto'),
                ]}
                value={formData.area}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, area: text }))}
                placeholder={t('createListing.enterArea') || 'Enter area (optional)'}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                maxLength={80}
                writingDirection={isRTL ? 'rtl' : 'ltr'}
              />
            </View>

            <CreateListingImages
              images={images}
              onPick={pickImage}
              onRemove={removeImage}
              onMove={moveImage}
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleNextStep}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>{t('common.next') || 'Next'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isEditMode
                  ? loading
                    ? t('editListing.saving')
                    : t('editListing.saveChanges')
                  : t('createListing.submitListing') || t('createListing.createAd')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <SearchablePickerSheet
        open={activeSheet === 'brand'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.brand')}
        options={brandOptions}
        selectedId={selectedBrandId}
        onSelect={(item) => handleBrandSelect(item.id)}
        searchPlaceholder={t('createListing.searchBrands') || 'Search brands'}
        variant="brand"
        popularHeader={t('createListing.popularBrands')}
        allHeader={t('createListing.allBrands')}
        manualEntry={{
          id: OTHER_BRAND_ID,
          title: t('createListing.cantFindBrand'),
          description: t('createListing.cantFindBrandHint'),
          buttonLabel: t('createListing.enterBrandManually'),
        }}
      />
      <SearchablePickerSheet
        open={activeSheet === 'model'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.model')}
        options={modelOptions}
        selectedId={formData.model_id}
        onSelect={(item) =>
          setFormData((prev) => ({
            ...prev,
            model_id: item.id,
            ...emptyModelDependentFields(),
          }))
        }
        searchPlaceholder={t('createListing.searchModels') || 'Search models'}
      />
      <SearchablePickerSheet
        open={activeSheet === 'storage'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.storage')}
        options={storageOptions}
        selectedId={formData.model_storage_id}
        onSelect={(item) =>
          setFormData((prev) => ({ ...prev, model_storage_id: item.id }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeSheet === 'caseSize'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.caseSize')}
        options={caseSizeOptions}
        selectedId={formData.model_watch_case_size_id}
        onSelect={(item) =>
          setFormData((prev) => ({ ...prev, model_watch_case_size_id: item.id }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeSheet === 'connectivity'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.connectivity')}
        options={connectivityOptions}
        selectedId={formData.model_watch_connectivity_id}
        onSelect={(item) =>
          setFormData((prev) => ({ ...prev, model_watch_connectivity_id: item.id }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeSheet === 'condition'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.condition')}
        options={conditionOptions}
        selectedId={formData.condition_id}
        onSelect={(item) => {
          setFormData((prev) => ({
            ...prev,
            condition_id: item.id,
            battery_percentage: item.name === 'New' ? '' : prev.battery_percentage,
          }));
        }}
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeSheet === 'color'}
        onClose={() => setActiveSheet(null)}
        title={isSmartwatch ? t('createListing.colorFinish') : t('createListing.color')}
        options={colorOptions}
        selectedId={formData.model_color_id}
        onSelect={(item) =>
          setFormData((prev) => ({ ...prev, model_color_id: item.id }))
        }
        searchable={colorOptions.length > 8}
      />
      <SearchablePickerSheet
        open={activeSheet === 'sim'}
        onClose={() => setActiveSheet(null)}
        title={t('createListing.simConfiguration')}
        options={simOptions}
        selectedId={formData.sim_configuration_id}
        onSelect={(item) =>
          setFormData((prev) => ({ ...prev, sim_configuration_id: item.id }))
        }
        searchable={false}
      />
      <SearchablePickerSheet
        open={activeSheet === 'city'}
        onClose={() => setActiveSheet(null)}
        title={t('home.city') || 'City'}
        options={cityOptions}
        selectedId={formData.city_id}
        onSelect={(item) => handleSelectCity(item.id)}
        searchPlaceholder={t('createListing.searchCities') || 'Search cities'}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  contentContainer: {
    paddingHorizontal: space[5],
    paddingTop: space[5],
    paddingBottom: space[8],
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: space[2],
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: space[6],
  },
  stack: { gap: space[5] },
  sectionLabel: {
    fontFamily: fonts.label,
    fontSize: 13,
    marginBottom: -space[2],
  },
  categoryRow: { gap: space[3] },
  categoryCard: {
    flex: 1,
    minHeight: 140,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: space[4],
    justifyContent: 'space-between',
  },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: fonts.headline,
    fontSize: 16,
  },
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  requiredAsterisk: {
    color: '#E53935',
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  priceInput: {
    fontFamily: fonts.display,
    fontSize: 36,
    minHeight: 72,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  batteryInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 56,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  descriptionInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 140,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[4],
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 17,
    color: '#ffffff',
  },
});
