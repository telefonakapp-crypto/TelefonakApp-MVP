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
  Image,
  Platform,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';

export default function CreateListingScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { language, isArabic, isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    model_id: '',
    storage_id: '',
    color_id: '',
    condition_id: '',
    battery_percentage: null,
    price: '',
    description: '',
    location: '',
  });

  // Generate battery percentage options from 100% to 70%
  const batteryOptions = Array.from({ length: 31 }, (_, i) => 100 - i);
  const batteryScrollRef = useRef(null);
  const [batteryScrollOffset, setBatteryScrollOffset] = useState(0);
  const isScrollingProgrammatically = useRef(false);
  const [isBatteryPickerExpanded, setIsBatteryPickerExpanded] = useState(false);
  
  // Refs for form fields to enable focusing
  const priceInputRef = useRef(null);
  const locationInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // Refs for field positions (for scrolling to them)
  const brandFieldRef = useRef(null);
  const modelFieldRef = useRef(null);
  const storageFieldRef = useRef(null);
  const colorFieldRef = useRef(null);
  const conditionFieldRef = useRef(null);

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [storage, setStorage] = useState([]);
  const [colorsList, setColorsList] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      fetchModels(selectedBrandId);
    } else {
      setModels([]);
      setFormData(prev => ({ ...prev, model_id: '' }));
    }
  }, [selectedBrandId]);

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

  // Helper function to calculate scroll offset for centering an item
  // The center of visible area is at VISIBLE_ITEMS * ITEM_HEIGHT / 2 = 125px from top of container
  // We want the item's vertical center to align with this 125px point
  // Item N's top edge in content: topPadding + (N * ITEM_HEIGHT)
  // Item N's center in content: topPadding + (N * ITEM_HEIGHT) + (ITEM_HEIGHT / 2)
  // When item is centered: scrollOffset + 125px = itemCenter
  // Therefore: scrollOffset = itemCenter - 125px
  // Calculate scroll offset to center item at itemIndex
  // When item is centered, its center should align with visible center (125px)
  // Item N center in content = topPadding + (N * ITEM_HEIGHT) + (ITEM_HEIGHT / 2)
  // After scrolling by offsetY, content position X appears at (X - offsetY) in visible area
  // So: (itemCenterInContent) - offsetY = visibleCenterY
  // Therefore: offsetY = itemCenterInContent - visibleCenterY
  const calculateScrollOffset = (itemIndex) => {
    const topPadding = ITEM_HEIGHT * 2; // 100px
    const visibleCenterY = VISIBLE_ITEMS * ITEM_HEIGHT / 2; // 125px
    const itemCenterInContent = topPadding + (itemIndex * ITEM_HEIGHT) + (ITEM_HEIGHT / 2);
    const offset = itemCenterInContent - visibleCenterY;
    // Bounds checking
    const minOffset = (topPadding + ITEM_HEIGHT / 2) - visibleCenterY; // Should be 0
    const maxOffset = (topPadding + ((batteryOptions.length - 1) * ITEM_HEIGHT) + ITEM_HEIGHT / 2) - visibleCenterY;
    return Math.max(0, Math.min(offset, maxOffset));
  };

  // Helper function to find which item is centered at a given scroll offset
  const findCenteredItem = (offsetY) => {
    const topPadding = ITEM_HEIGHT * 2; // 100px
    const visibleCenter = VISIBLE_ITEMS * ITEM_HEIGHT / 2; // 125px
    // At scroll position offsetY, what content position is at the visible center?
    const contentYAtCenter = offsetY + visibleCenter;
    // Which item's center is closest? Item N center = topPadding + (N * ITEM_HEIGHT) + (ITEM_HEIGHT / 2)
    // We need: topPadding + (N * ITEM_HEIGHT) + (ITEM_HEIGHT / 2) ≈ contentYAtCenter
    // Solving: N ≈ (contentYAtCenter - topPadding - ITEM_HEIGHT / 2) / ITEM_HEIGHT
    // Simplified: N ≈ (offsetY + visibleCenter - topPadding - ITEM_HEIGHT / 2) / ITEM_HEIGHT
    // Since visibleCenter = 125, topPadding = 100, ITEM_HEIGHT / 2 = 25
    // N ≈ (offsetY + 125 - 100 - 25) / 50 = offsetY / 50
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

  // Handle scroll end - snap to nearest item if needed
  const handleScrollEnd = (offsetY) => {
    if (isScrollingProgrammatically.current) {
      isScrollingProgrammatically.current = false;
      return;
    }

    const centeredIndex = findCenteredItem(offsetY);
    const targetOffset = calculateScrollOffset(centeredIndex);
    const selectedValue = batteryOptions[centeredIndex];
    
    // Always snap to ensure perfect centering (threshold of 1px for precision)
    if (Math.abs(offsetY - targetOffset) > 1) {
      setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));
      
      isScrollingProgrammatically.current = true;
      if (batteryScrollRef.current) {
        batteryScrollRef.current.scrollTo({ 
          y: targetOffset, 
          animated: true 
        });
        setBatteryScrollOffset(targetOffset);
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 500);
      }
    } else {
      // Already perfectly centered, just update value
      setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));
    }
  };

  // Scroll to selected battery percentage on initial load only (if set)
  useEffect(() => {
    if (formData.battery_percentage !== null && batteryScrollRef.current && batteryScrollOffset === 0) {
      const selectedIndex = batteryOptions.findIndex(p => p === formData.battery_percentage);
      if (selectedIndex >= 0) {
        const scrollOffset = selectedIndex * ITEM_HEIGHT;
        isScrollingProgrammatically.current = true;
        setTimeout(() => {
          batteryScrollRef.current?.scrollTo({ y: scrollOffset, animated: false });
          setBatteryScrollOffset(scrollOffset);
          setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 100);
        }, 200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [brandsRes, storageRes, colorsRes, conditionsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/brands`),
        axios.get(`${API_BASE_URL}/storage`),
        axios.get(`${API_BASE_URL}/colors`),
        axios.get(`${API_BASE_URL}/conditions`),
      ]);

      setBrands(brandsRes.data.brands);
      setStorage(storageRes.data.storage);
      setColorsList(colorsRes.data.colors);
      setConditions(conditionsRes.data.conditions);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setFetching(false);
    }
  };

  const fetchModels = async (brandId) => {
    try {
      const modelsRes = await axios.get(`${API_BASE_URL}/brands/${brandId}/models`);
      setModels(modelsRes.data.models);
    } catch (error) {
      console.error('Error fetching models:', error);
      Alert.alert('Error', 'Failed to load models');
    }
  };

  // Auto-translate function (simple implementation - can be enhanced with proper translation API)

  const handleBrandSelect = (brandId) => {
    setSelectedBrandId(brandId);
    setFormData(prev => ({ ...prev, model_id: '' })); // Clear model selection when brand changes
    setModelSearchQuery(''); // Clear search
  };

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages].slice(0, 10)); // Limit to 10 images
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

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

  const handleSubmit = async () => {
    // Validate all required fields and focus on the first missing one
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
    
    if (!formData.storage_id) {
      Alert.alert('Error', 'Please select storage');
      scrollToField('storage');
      return;
    }
    
    if (!formData.color_id) {
      Alert.alert('Error', 'Please select a color');
      scrollToField('color');
      return;
    }
    
    if (!formData.condition_id) {
      Alert.alert('Error', 'Please select a condition');
      scrollToField('condition');
      return;
    }
    
    // Check battery percentage if condition is not "New"
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
    
    if (!formData.location || formData.location.trim() === '') {
      Alert.alert('Error', 'Please enter a location');
      scrollToField('location');
      setTimeout(() => {
        locationInputRef.current?.focus();
      }, 300);
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Convert images to base64 (for now - in production, upload to cloud storage)
      const imageUrls = [];
      for (const imageUri of images) {
        // For now, we'll send the local URI. In production, upload to cloud storage first
        // and send the cloud URL
        imageUrls.push(imageUri);
      }

      const response = await axios.post(
        `${API_BASE_URL}/listings`,
        {
          ...formData,
          price: parseFloat(formData.price),
          images: imageUrls,
          // Send both descriptions
          // Send description based on current language
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

      Alert.alert(t('common.success'), t('createListing.listingCreated'), [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating listing:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create listing'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
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
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('createListing.createListing')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.form}>
          <View 
            style={styles.inputGroup} 
            ref={brandFieldRef}
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
                    selectedBrandId === brand.id && styles.pickerOptionActive,
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
              ref={modelFieldRef}
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
                          formData.model_id === model.id && styles.pickerOptionActive,
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
            ref={storageFieldRef}
            onLayout={(e) => handleFieldLayout('storage', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.storage')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {storage.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: formData.storage_id === item.id ? colors.primary : colors.surface, borderColor: formData.storage_id === item.id ? colors.primary : colors.inputBorder },
                  ]}
                  onPress={() => setFormData({ ...formData, storage_id: item.id })}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: formData.storage_id === item.id ? '#ffffff' : colors.text },
                      getTextAlign(isRTL, 'center'),
                    ]}
                  >
                    {item.capacity_gb} GB
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View 
            style={styles.inputGroup} 
            ref={conditionFieldRef}
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
                    setFormData({ ...formData, condition_id: condition.id });
                    // Reset battery percentage if condition is "New"
                    if (condition.name === 'New') {
                      setFormData(prev => ({ ...prev, condition_id: condition.id, battery_percentage: null }));
                      setIsBatteryPickerExpanded(false);
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
                // Collapsed view - show selected value
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
                // Expanded view - show picker with center indicator
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
                            // Update selected value based on current scroll position
                            const centeredIndex = findCenteredItem(offsetY);
                            const selectedValue = batteryOptions[centeredIndex];
                            if (formData.battery_percentage !== selectedValue) {
                              setFormData(prev => ({ ...prev, battery_percentage: selectedValue }));
                            }
                          }
                        }}
                        onScrollEndDrag={handleScrollEnd}
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
                        {/* Top padding for centering - allows first item to scroll to center */}
                        <View style={{ height: ITEM_HEIGHT * 2 }} />
                        {batteryOptions.map((percent, index) => {
                          const topPadding = ITEM_HEIGHT * 2; // 100px padding at top
                          const visibleCenterY = VISIBLE_ITEMS * ITEM_HEIGHT / 2; // 125px - visible center
                          // Each item occupies exactly ITEM_HEIGHT pixels
                          // Item N starts at: topPadding + (N * ITEM_HEIGHT)
                          // Item N center is at: topPadding + (N * ITEM_HEIGHT) + (ITEM_HEIGHT / 2)
                          const itemTopInContent = topPadding + (index * ITEM_HEIGHT);
                          const itemCenterInContent = itemTopInContent + (ITEM_HEIGHT / 2);
                          // At current scroll position, what content Y is at the visible center?
                          const contentYAtVisibleCenter = batteryScrollOffset + visibleCenterY;
                          // Distance from center for visual effects
                          const distanceFromCenter = Math.abs(contentYAtVisibleCenter - itemCenterInContent);
                          const normalizedDistance = Math.min(distanceFromCenter / ITEM_HEIGHT, 1.5);
                          const isSelected = formData.battery_percentage === percent;
                          // Only apply visual effects to non-selected items
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
                                    batteryScrollRef.current.scrollTo({ 
                                      y: finalOffset, 
                                      animated: true 
                                    });
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
                        {/* Bottom padding for centering - allows last item to scroll to center */}
                        <View style={{ height: ITEM_HEIGHT * 2 }} />
                      </ScrollView>
                      {/* Center indicator lines - positioned so selected item is BETWEEN them */}
                      {/* When centered: item top=100px, center=125px, bottom=150px */}
                      {/* Lines: top=99px (1px above), bottom=151px (1px below) */}
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
                  {/* Done button */}
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
            ref={colorFieldRef}
            onLayout={(e) => handleFieldLayout('color', e)}
          >
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('createListing.color')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, getFlexDirection(isRTL, 'row')]}>
              {colorsList.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  style={[
                    styles.pickerOption,
                    { 
                      backgroundColor: formData.color_id === color.id ? colors.primary : colors.surface,
                      borderColor: formData.color_id === color.id ? colors.primary : colors.inputBorder 
                    },
                    formData.color_id === color.id && styles.pickerOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, color_id: color.id })}
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
                        { color: formData.color_id === color.id ? '#ffffff' : colors.text },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {color.name}
                    </Text>
                  </View>
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
            <TextInput
              ref={locationInputRef}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder={t('createListing.cityJordan')}
              placeholderTextColor={colors.textSecondary}
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('createListing.images')}</Text>
            <Text style={[styles.imageHint, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('createListing.addUpTo10Images')}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.imageScroll}
              contentContainerStyle={isRTL ? { flexDirection: 'row-reverse' } : {}}
            >
              {images.map((uri, index) => (
                <View key={index} style={[styles.imageContainer, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                  <Image source={{ uri }} style={[styles.imagePreview, { backgroundColor: colors.inputBackground }]} />
                  <TouchableOpacity
                    style={[styles.removeImageButton, { backgroundColor: colors.surface }, { right: isRTL ? 'auto' : -8, left: isRTL ? -8 : 'auto' }]}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 10 && (
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
              <Text style={styles.submitButtonText}>{t('createListing.createAd')}</Text>
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
  pickerOptionActive: {},
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: '#ffffff',
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
  modelYearActive: {
    color: '#ffffff',
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
    paddingTop: 0,
    paddingBottom: 0,
  },
  wheelPickerItem: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  wheelPickerItemText: {
    textAlign: 'center',
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

