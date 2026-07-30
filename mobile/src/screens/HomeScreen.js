import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { API_BASE_URL } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import {
  EMPTY_MARKETPLACE_FILTERS,
  countActiveMarketplaceFilters,
  buildMarketplaceListingParams,
  validateMarketplaceFilters,
  localizedPlaceName,
  normalizeMarketplaceSearch,
} from '../utils/marketplaceFilters';
import { filterMvpCategories } from '../utils/mvpCategories';
import { handleBannerAction } from '../utils/bannerActions';
import { useFavorites } from '../context/FavoritesContext';
import { useNotifications } from '../context/NotificationsContext';
import FavoriteButton from '../components/FavoriteButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  const { loadFavorites, clearFavorites } = useFavorites();
  // Badge count is shared with the Notifications screen so both stay in sync.
  const { unreadCount, refreshUnreadCount, clearUnreadCount } = useNotifications();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [brands, setBrands] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  const [filterModels, setFilterModels] = useState([]);
  const [modelStorages, setModelStorages] = useState([]);
  const [modelColors, setModelColors] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const searchInputRef = useRef(null);
  const conditionScrollRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const modelScrollRef = useRef(null);
  const storageScrollRef = useRef(null);
  const colorScrollRef = useRef(null);
  const cityScrollRef = useRef(null);
  const areaScrollRef = useRef(null);
  const sortScrollRef = useRef(null);
  const brandScrollRef = useRef(null);
  const [imageErrors, setImageErrors] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH)).current;
  const [banners, setBanners] = useState([]);
  const [originalBannerCount, setOriginalBannerCount] = useState(0);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannersScrollRef = useRef(null);
  const bannersAutoScrollInterval = useRef(null);
  const isScrollingRef = useRef(false);
  const pendingResetRef = useRef(false);
  
  // Filter state
  const [filters, setFilters] = useState({ ...EMPTY_MARKETPLACE_FILTERS });

  // Brand logo mapping - using Google Favicons API only
  const getBrandLogo = (brandName) => {
    // Map brand names to their official domains for Google Favicons
    const brandDomainMap = {
      'Apple': 'apple.com',
      'Samsung': 'samsung.com',
      'Xiaomi': 'mi.com',
      'Huawei': 'huawei.com',
      'Honor': 'hihonor.com',
      'Oppo': 'oppo.com',
      'Vivo': 'vivo.com',
      'OnePlus': 'oneplus.com',
      'Realme': 'realme.com',
      'Nokia': 'nokia.com',
      'Motorola': 'motorola.com',
      'Google': 'google.com',
      'Sony': 'sony.com',
    };
    
    const domain = brandDomainMap[brandName];
    if (domain) {
      // Google Favicons API - provides PNG format, size 128 for better quality
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
    
    // Fallback - construct domain from brand name
    const brandLower = brandName.toLowerCase().replace(/\s+/g, '');
    return `https://www.google.com/s2/favicons?domain=${brandLower}.com&sz=128`;
  };

  const handleCloseMenu = useCallback(() => {
    // Animate menu sliding out (to right in LTR, to left in RTL)
    Animated.timing(menuSlideAnim, {
      toValue: isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowMenu(false);
      // Reset animation value for next open
      menuSlideAnim.setValue(isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH);
      // Refresh user name when menu closes (in case profile was edited)
      fetchAdminStatus();
    });
  }, [menuSlideAnim, fetchAdminStatus, isRTL]);

  const fetchAdminStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/user/profile');
      setIsAdmin(response.data.user?.is_admin === true);
      if (response.data.user) {
        const firstName = response.data.user.first_name || '';
        const lastName = response.data.user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        setUserName(fullName || 'User');
      } else {
        setUserName('User');
      }
    } catch (error) {
      console.error('Error fetching admin status:', error);
      setIsAdmin(false);
      setUserName('User');
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const response = await apiClient.get('/banners');
      const fetchedBanners = response.data.banners || [];

      setOriginalBannerCount(fetchedBanners.length);

      // Duplicate for seamless infinite carousel when multiple banners exist
      const duplicatedBanners = fetchedBanners.length > 1
        ? [...fetchedBanners, ...fetchedBanners, ...fetchedBanners]
        : fetchedBanners;

      setBanners(duplicatedBanners);

      if (fetchedBanners.length > 0) {
        const startIndex = fetchedBanners.length > 1 ? fetchedBanners.length : 0;
        setCurrentBannerIndex(startIndex);
        if (bannersScrollRef.current && fetchedBanners.length > 1) {
          const bannerWidth = SCREEN_WIDTH - 32;
          setTimeout(() => {
            bannersScrollRef.current?.scrollTo({
              x: startIndex * bannerWidth,
              animated: false,
            });
          }, 200);
        } else if (bannersScrollRef.current) {
          bannersScrollRef.current.scrollTo({ x: 0, animated: false });
        }
      }
    } catch (error) {
      // Banner failures must not block Home listings
      console.error('Error fetching banners:', error);
      setBanners([]);
      setOriginalBannerCount(0);
    }
  }, []);

  useEffect(() => {
    fetchFilterData();
    refreshUnreadCount();
    fetchAdminStatus();
    fetchBanners();
    // Cached in FavoritesContext, so this only hits the API once per session.
    loadFavorites();
  }, [refreshUnreadCount, fetchAdminStatus, fetchBanners, loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
      fetchAdminStatus();
      fetchBanners();
    }, [refreshUnreadCount, fetchAdminStatus, fetchBanners])
  );

  // Refresh user name when screen comes into focus (e.g., after editing profile)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAdminStatus();
    });
    return unsubscribe;
  }, [navigation, fetchAdminStatus]);

  // Auto-scroll banners if there are multiple
  useEffect(() => {
    const setupTimer = setTimeout(() => {
      if (originalBannerCount > 1 && bannersScrollRef.current && banners.length > 0) {
        if (bannersAutoScrollInterval.current) {
          clearInterval(bannersAutoScrollInterval.current);
        }

        bannersAutoScrollInterval.current = setInterval(() => {
          if (isScrollingRef.current || !bannersScrollRef.current) {
            return;
          }

          const bannerWidth = SCREEN_WIDTH - 32;

          setCurrentBannerIndex((prevIndex) => {
            let nextIndex = prevIndex + 1;
            let scrollX = nextIndex * bannerWidth;

            if (bannersScrollRef.current) {
              if (nextIndex >= originalBannerCount * 2) {
                pendingResetRef.current = true;
              }

              bannersScrollRef.current.scrollTo({
                x: scrollX,
                animated: true,
              });
            }

            return nextIndex;
          });
        }, 4000);
      }
    }, 500);

    return () => {
      clearTimeout(setupTimer);
      if (bannersAutoScrollInterval.current) {
        clearInterval(bannersAutoScrollInterval.current);
      }
    };
  }, [originalBannerCount, banners.length]);

  const handleBannersScrollBeginDrag = () => {
    isScrollingRef.current = true;
  };

  const handleBannersScrollEnd = (event) => {
    if (!event || !bannersScrollRef.current) {
      isScrollingRef.current = false;
      pendingResetRef.current = false;
      return;
    }

    const scrollPosition = event.nativeEvent.contentOffset.x;
    const bannerWidth = SCREEN_WIDTH - 32;
    let index = Math.round(scrollPosition / bannerWidth);

    if (pendingResetRef.current && originalBannerCount > 1 && index >= originalBannerCount * 2) {
      index = originalBannerCount + (index % originalBannerCount);
      bannersScrollRef.current.scrollTo({
        x: index * bannerWidth,
        animated: false,
      });
      setCurrentBannerIndex(index);
      pendingResetRef.current = false;
      isScrollingRef.current = false;
      return;
    }

    if (originalBannerCount > 1 && index < originalBannerCount) {
      index = originalBannerCount + index;
      bannersScrollRef.current.scrollTo({
        x: index * bannerWidth,
        animated: false,
      });
      setCurrentBannerIndex(index);
      isScrollingRef.current = false;
      return;
    }

    if (index >= originalBannerCount && index < originalBannerCount * 2) {
      pendingResetRef.current = false;
    }

    setCurrentBannerIndex(index);
    isScrollingRef.current = false;
  };

  const sortBrands = (brandsList) => {
    return [...brandsList].sort((a, b) => {
      if (a.name.toLowerCase() === 'apple') return -1;
      if (b.name.toLowerCase() === 'apple') return 1;
      if (a.name.toLowerCase() === 'samsung') return -1;
      if (b.name.toLowerCase() === 'samsung') return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const fetchFilterData = async () => {
    try {
      const [brandsRes, categoriesRes, conditionsRes, citiesRes] = await Promise.all([
        apiClient.get('/brands'),
        apiClient.get('/categories'),
        apiClient.get('/conditions'),
        apiClient.get('/cities'),
      ]);

      const sorted = sortBrands(brandsRes.data.brands || []);
      setBrands(sorted);
      setFilterBrands(sorted);
      setCategories(filterMvpCategories(categoriesRes.data.categories || []));
      setConditions(conditionsRes.data.conditions || []);
      setCities(citiesRes.data.cities || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const handleSelectCategory = async (cat_id) => {
    try {
      const url = cat_id ? `/brands?category_id=${cat_id}` : '/brands';
      const res = await apiClient.get(url);
      setFilterBrands(sortBrands(res.data.brands || []));
    } catch (e) {
      // keep existing filterBrands
    }
    setFilters(prev => ({
      ...prev,
      category_id: cat_id,
      brand_id: '',
      model_id: '',
      model_storage_id: '',
      model_color_id: '',
      min_battery: '',
      max_battery: '',
    }));
    setFilterModels([]);
    setModelStorages([]);
    setModelColors([]);
  };

  const handleSelectBrand = async (brand_id) => {
    const currentCategoryId = filters.category_id;
    setFilters(prev => ({
      ...prev,
      brand_id,
      model_id: '',
      model_storage_id: '',
      model_color_id: '',
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
    setFilters(prev => ({
      ...prev,
      model_id,
      model_storage_id: '',
      model_color_id: '',
    }));
    setModelStorages([]);
    setModelColors([]);
    if (model_id) {
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
    setFilters(prev => ({ ...prev, city_id, area_id: '' }));
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

  const fetchListings = React.useCallback(async (search = '', appliedFilters = {}) => {
    try {
      const params = buildMarketplaceListingParams(appliedFilters, { search, limit: 20 });
      const response = await apiClient.get(`/listings?${params.toString()}`);
      const fetchedListings = response.data.listings || [];
      setListings(fetchedListings);
      return fetchedListings;
    } catch (error) {
      console.error('Error fetching listings:', error);
      setListings([]);
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    fetchListings(debouncedSearchQuery, filters);
  }, [fetchListings, debouncedSearchQuery, filters]);

  useFocusEffect(
    React.useCallback(() => {
      fetchListings(debouncedSearchQuery, filters);
    }, [fetchListings, debouncedSearchQuery, filters])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings(debouncedSearchQuery, filters);
    fetchBanners();
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    searchInputRef.current?.blur();
  };

  const getListingsEmptyMessage = () => {
    const hasFilters = countActiveMarketplaceFilters(filters) > 0;
    const hasSearch = debouncedSearchQuery.length > 0;
    if (hasSearch && hasFilters) {
      return t('home.noMatchingFilters') || 'No listings match your filters';
    }
    if (hasSearch) {
      return t('home.noSearchResults') || 'No results found';
    }
    if (hasFilters) {
      return t('home.noMatchingFilters') || 'No listings match your filters';
    }
    return t('home.noListings');
  };

  const getActiveFiltersCount = () => countActiveMarketplaceFilters(filters);

  const handleApplyFilters = () => {
    const error = validateMarketplaceFilters(filters);
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    setShowFilterModal(false);
    setLoading(true);
    fetchListings(debouncedSearchQuery, filters);
  };

  const handleClearFilters = () => {
    const cleared = { ...EMPTY_MARKETPLACE_FILTERS };
    setFilters(cleared);
    setFilterModels([]);
    setModelStorages([]);
    setModelColors([]);
    setAreas([]);
    setShowFilterModal(false);
    setLoading(true);
    fetchListings(debouncedSearchQuery, cleared);
  };

  const handleListingPress = (listingId) => {
    navigation.navigate('ListingDetails', { listingId });
  };

  const handleCreateListing = () => {
    navigation.navigate('CreateListing');
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('settings.logoutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Close menu
              setShowMenu(false);
              
              // Clear storage
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('hasSeenOnboarding');
              clearFavorites();
              clearUnreadCount();
              
              // Reset navigation to Login screen
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              );
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={[styles.headerTop, getFlexDirection(isRTL, 'row')]}>
            <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.telefonak')}</Text>
            <View style={[styles.headerRight, getFlexDirection(isRTL, 'row')]}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => setShowMenu(true)}
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.searchFilterRow, getFlexDirection(isRTL, 'row')]}>
            <View
              style={[styles.searchContainer, styles.searchContainerFlex, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            >
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }, getTextAlign(isRTL, 'left')]}
                placeholder={t('home.searchMobiles')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="never"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.searchClearButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.filterEntryButton,
                {
                  backgroundColor: getActiveFiltersCount() > 0 ? colors.primary : colors.inputBackground,
                  borderColor: getActiveFiltersCount() > 0 ? colors.primary : colors.inputBorder,
                },
              ]}
              onPress={() => setShowFilterModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('home.filterTitle')}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={getActiveFiltersCount() > 0 ? '#ffffff' : colors.primary}
              />
              <Text
                style={[
                  styles.filterEntryButtonText,
                  { color: getActiveFiltersCount() > 0 ? '#ffffff' : colors.text },
                ]}
                numberOfLines={1}
              >
                {t('common.filter')}
              </Text>
              {getActiveFiltersCount() > 0 && (
                <View style={styles.filterEntryBadge}>
                  <Text style={styles.filterEntryBadgeText}>{getActiveFiltersCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {getActiveFiltersCount() > 0 && (
            <View style={[styles.activeFiltersBar, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.activeFiltersBarText, { color: colors.textSecondary }]}>
                {getActiveFiltersCount()} {t('home.filterTitle')}
              </Text>
              <TouchableOpacity onPress={handleClearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.activeFiltersClearText, { color: colors.primary }]}>
                  {t('home.clearAll')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Marketing Banners */}
          {banners.length > 0 && (
            <View style={styles.adsSection}>
              <View style={styles.adsBannerWrapper}>
                <ScrollView
                  ref={bannersScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled
                  scrollEnabled={originalBannerCount > 1}
                  onScrollBeginDrag={handleBannersScrollBeginDrag}
                  onMomentumScrollEnd={handleBannersScrollEnd}
                  onScrollEndDrag={handleBannersScrollEnd}
                  scrollEventThrottle={16}
                  decelerationRate={0.98}
                  snapToInterval={SCREEN_WIDTH - 32}
                  snapToAlignment="start"
                  bounces={false}
                  style={styles.adsScrollView}
                  contentContainerStyle={styles.adsContainer}
                >
                  {banners.map((banner, index) => (
                    <View key={`${banner.id}-${index}`} style={styles.adBanner}>
                      <View style={styles.adsBannerContainer}>
                        <TouchableOpacity
                          style={styles.adTouchable}
                          onPress={() =>
                            handleBannerAction(banner, { navigation, Linking, Alert })
                          }
                          activeOpacity={banner.action_type && banner.action_type !== 'none' ? 0.8 : 1}
                          disabled={!banner.action_type || banner.action_type === 'none'}
                        >
                          <Image
                            source={{ uri: banner.image_url }}
                            style={styles.adImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
              {originalBannerCount > 1 && (
                <View style={styles.bannerDots}>
                  {Array.from({ length: originalBannerCount }).map((_, i) => {
                    const activeIndex =
                      originalBannerCount > 0
                        ? ((currentBannerIndex % originalBannerCount) + originalBannerCount) %
                          originalBannerCount
                        : 0;
                    return (
                      <View
                        key={`banner-dot-${i}`}
                        style={[
                          styles.bannerDot,
                          i === activeIndex && styles.bannerDotActive,
                          {
                            backgroundColor:
                              i === activeIndex ? colors.primary : colors.inputBorder,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Brands */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.brands')}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                <Text style={[styles.seeAllText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesContainer}
            >
              {brands.slice(0, 10).map((brand) => (
                <TouchableOpacity 
                  key={brand.id} 
                  style={styles.categoryItem}
                  onPress={() => {
                    const isCurrentlySelected = filters.brand_id === brand.id.toString();
                    const newFilters = {
                      ...filters,
                      brand_id: isCurrentlySelected ? '' : brand.id.toString(),
                      model_id: '',
                      model_storage_id: '',
                      model_color_id: '',
                    };
                    setFilters(newFilters);
                    setFilterModels([]);
                    setModelStorages([]);
                    setModelColors([]);
                    setLoading(true);
                    fetchListings(debouncedSearchQuery, newFilters);
                  }}
                >
                  <View style={[
                    styles.categoryBox,
                    { 
                      backgroundColor: filters.brand_id === brand.id.toString() 
                        ? colors.primary 
                        : (isDarkMode ? colors.surface : colors.inputBackground), 
                      borderColor: filters.brand_id === brand.id.toString() ? colors.primary : colors.inputBorder 
                    },
                    filters.brand_id === brand.id.toString() && styles.categoryBoxActive
                  ]}>
                    {imageErrors[brand.id] ? (
                      <View style={[styles.brandLogoPlaceholder, { backgroundColor: isDarkMode ? colors.card : colors.borderLight }]}>
                        <Text style={[styles.brandInitial, { color: filters.brand_id === brand.id.toString() ? '#ffffff' : colors.text }]}>{brand.name.charAt(0)}</Text>
                      </View>
                    ) : (
                      <Image 
                        source={{ 
                          uri: getBrandLogo(brand.name),
                          cache: 'default'
                        }}
                        style={styles.brandLogo}
                        resizeMode="contain"
                        onError={(error) => {
                          console.log('Logo load error for', brand.name);
                          setImageErrors(prev => ({ ...prev, [brand.id]: true }));
                        }}
                        onLoad={() => {
                          // Reset error state on successful load
                          if (imageErrors[brand.id]) {
                            setImageErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors[brand.id];
                              return newErrors;
                            });
                          }
                        }}
                      />
                    )}
                    <Text style={[
                      styles.categoryText,
                      { color: filters.brand_id === brand.id.toString() ? '#ffffff' : colors.text }
                    ]}>
                      {brand.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>


          {/* Fresh Arrivals */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.freshArrivals')}</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : listings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {getListingsEmptyMessage()}
                </Text>
                {debouncedSearchQuery.length > 0 && (
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
                    {t('home.tryDifferentKeywords')}
                  </Text>
                )}
                {countActiveMarketplaceFilters(filters) > 0 && (
                  <TouchableOpacity
                    style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
                    onPress={handleClearFilters}
                  >
                    <Text style={styles.clearFiltersButtonText}>{t('home.clearFilters') || 'Clear Filters'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.grid}>
                {listings.map((listing) => (
                  <TouchableOpacity
                    key={listing.id}
                    style={[styles.card, { backgroundColor: colors.surface }]}
                    onPress={() => handleListingPress(listing.id)}
                  >
                    <View style={styles.cardImageContainer}>
                      {listing.thumbnail_image ? (
                        <Image
                          source={{ uri: listing.thumbnail_image }}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.cardImage, { backgroundColor: colors.borderLight }]} />
                      )}
                      <FavoriteButton listingId={listing.id} />
                      <View style={[styles.conditionBadge, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)' }]}>
                        <Text style={[styles.conditionText, { color: isDarkMode ? '#09090b' : '#ffffff' }]}>
                          {(() => {
                            const conditionKey = listing.condition_name?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
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
                            return conditionMap[conditionKey] || listing.condition_name || '';
                          })()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {listing.brand_name} {listing.model_name}
                      </Text>
                      <Text style={[styles.cardPrice, { color: colors.primary }]}>{listing.price} JOD</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Nav */}
        <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="home" size={24} color={colors.primary} />
            <Text style={[styles.navLabel, styles.navLabelActive, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('home.home')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('MyListings', { isAdmin })}
          >
            <Ionicons name="list-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{isAdmin ? t('home.allListings') : t('home.myListings')}</Text>
          </TouchableOpacity>
          <View style={styles.addButtonContainer}>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleCreateListing}>
              <Ionicons name="add-circle" size={32} color="#ffffff" />
            </TouchableOpacity>
                  <Text style={[styles.navLabel, { color: colors.textSecondary }]}>{t('home.sellPhone')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('Notifications')}
          >
            <View style={styles.navIconContainer}>
              <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={[styles.navNotificationBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.navNotificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('home.notifications')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('home.profileNav')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
        onShow={() => {
          if (isRTL) {
            requestAnimationFrame(() => {
              setTimeout(() => {
                [categoryScrollRef, brandScrollRef, modelScrollRef, storageScrollRef, colorScrollRef, conditionScrollRef, cityScrollRef, areaScrollRef, sortScrollRef].forEach(ref => {
                  ref.current?.scrollToEnd({ animated: false });
                });
              }, 100);
            });
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.modalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.filterTitle')}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
              {/* Category Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t('home.category') || 'Category'}
                </Text>
                <ScrollView
                  ref={categoryScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipContainer}
                  onLayout={() => {
                    if (isRTL && categoryScrollRef.current) {
                      setTimeout(() => categoryScrollRef.current?.scrollToEnd({ animated: false }), 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...categories].reverse().map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.category_id === cat.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.category_id === cat.id.toString() && styles.filterChipActive,
                            { marginRight: 0, marginLeft: 8 },
                          ]}
                          onPress={() => handleSelectCategory(cat.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.category_id === cat.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {language === 'ar' ? (cat.name_ar || cat.name_en || cat.name) : (cat.name_en || cat.name)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.category_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.category_id === '' && styles.filterChipActive,
                          { marginRight: 0, marginLeft: 8 },
                        ]}
                        onPress={() => handleSelectCategory('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.category_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.category_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.category_id === '' && styles.filterChipActive,
                        ]}
                        onPress={() => handleSelectCategory('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.category_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.category_id === cat.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.category_id === cat.id.toString() && styles.filterChipActive,
                          ]}
                          onPress={() => handleSelectCategory(cat.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.category_id === cat.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {language === 'ar' ? (cat.name_ar || cat.name_en || cat.name) : (cat.name_en || cat.name)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Brand Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.brand')}</Text>
                <ScrollView
                  ref={brandScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipContainer}
                  onLayout={() => {
                    if (isRTL && brandScrollRef.current) {
                      setTimeout(() => brandScrollRef.current?.scrollToEnd({ animated: false }), 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...filterBrands].reverse().map((brand) => (
                        <TouchableOpacity
                          key={brand.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.brand_id === brand.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.brand_id === brand.id.toString() && styles.filterChipActive,
                            { marginRight: 0, marginLeft: 8 },
                          ]}
                          onPress={() => handleSelectBrand(brand.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.brand_id === brand.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {brand.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.brand_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.brand_id === '' && styles.filterChipActive,
                          { marginRight: 0, marginLeft: 8 },
                        ]}
                        onPress={() => handleSelectBrand('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.brand_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.brand_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.brand_id === '' && styles.filterChipActive,
                        ]}
                        onPress={() => handleSelectBrand('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.brand_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {filterBrands.map((brand) => (
                        <TouchableOpacity
                          key={brand.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.brand_id === brand.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.brand_id === brand.id.toString() && styles.filterChipActive,
                          ]}
                          onPress={() => handleSelectBrand(brand.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.brand_id === brand.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {brand.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Model Filter — only when brand selected */}
              {filters.brand_id !== '' && (
                <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {t('home.model') || 'Model'}
                  </Text>
                  {filterModels.length === 0 ? (
                    <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>—</Text>
                  ) : (
                    <ScrollView
                      ref={modelScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipContainer}
                      onLayout={() => {
                        if (isRTL && modelScrollRef.current) {
                          setTimeout(() => modelScrollRef.current?.scrollToEnd({ animated: false }), 50);
                        }
                      }}
                    >
                      {isRTL ? (
                        <>
                          {[...filterModels].reverse().map((model) => (
                            <TouchableOpacity
                              key={model.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_id === model.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_id === model.id.toString() && styles.filterChipActive,
                                { marginRight: 0, marginLeft: 8 },
                              ]}
                              onPress={() => handleSelectModel(model.id.toString())}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_id === model.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {model.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_id === '' && styles.filterChipActive,
                              { marginRight: 0, marginLeft: 8 },
                            ]}
                            onPress={() => handleSelectModel('')}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_id === '' && styles.filterChipActive,
                            ]}
                            onPress={() => handleSelectModel('')}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                          {filterModels.map((model) => (
                            <TouchableOpacity
                              key={model.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_id === model.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_id === model.id.toString() && styles.filterChipActive,
                              ]}
                              onPress={() => handleSelectModel(model.id.toString())}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_id === model.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {model.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Storage Filter — only when model selected */}
              {filters.model_id !== '' && (
                <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {t('home.storage') || 'Storage'}
                  </Text>
                  {modelStorages.length === 0 ? (
                    <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>
                      {t('home.selectModelForStorage') || 'Select a model first'}
                    </Text>
                  ) : (
                    <ScrollView
                      ref={storageScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipContainer}
                      onLayout={() => {
                        if (isRTL && storageScrollRef.current) {
                          setTimeout(() => storageScrollRef.current?.scrollToEnd({ animated: false }), 50);
                        }
                      }}
                    >
                      {isRTL ? (
                        <>
                          {[...modelStorages].reverse().map((s) => (
                            <TouchableOpacity
                              key={s.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_storage_id === s.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_storage_id === s.id.toString() && styles.filterChipActive,
                                { marginRight: 0, marginLeft: 8 },
                              ]}
                              onPress={() => setFilters(prev => ({ ...prev, model_storage_id: s.id.toString() }))}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_storage_id === s.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {s.label || s.capacity_gb ? `${s.capacity_gb} GB` : s.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_storage_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_storage_id === '' && styles.filterChipActive,
                              { marginRight: 0, marginLeft: 8 },
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, model_storage_id: '' }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_storage_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_storage_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_storage_id === '' && styles.filterChipActive,
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, model_storage_id: '' }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_storage_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                          {modelStorages.map((s) => (
                            <TouchableOpacity
                              key={s.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_storage_id === s.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_storage_id === s.id.toString() && styles.filterChipActive,
                              ]}
                              onPress={() => setFilters(prev => ({ ...prev, model_storage_id: s.id.toString() }))}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_storage_id === s.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {s.label || (s.capacity_gb ? `${s.capacity_gb} GB` : String(s.id))}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Color Filter — only when model selected */}
              {filters.model_id !== '' && (
                <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {t('home.color') || 'Color'}
                  </Text>
                  {modelColors.length === 0 ? (
                    <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>
                      {t('home.selectModelForColor') || 'Select a model first'}
                    </Text>
                  ) : (
                    <ScrollView
                      ref={colorScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipContainer}
                      onLayout={() => {
                        if (isRTL && colorScrollRef.current) {
                          setTimeout(() => colorScrollRef.current?.scrollToEnd({ animated: false }), 50);
                        }
                      }}
                    >
                      {isRTL ? (
                        <>
                          {[...modelColors].reverse().map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_color_id === c.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_color_id === c.id.toString() && styles.filterChipActive,
                                { marginRight: 0, marginLeft: 8 },
                              ]}
                              onPress={() => setFilters(prev => ({ ...prev, model_color_id: c.id.toString() }))}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_color_id === c.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {c.display_name || c.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_color_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_color_id === '' && styles.filterChipActive,
                              { marginRight: 0, marginLeft: 8 },
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, model_color_id: '' }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_color_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.model_color_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.model_color_id === '' && styles.filterChipActive,
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, model_color_id: '' }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.model_color_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {t('home.all')}
                            </Text>
                          </TouchableOpacity>
                          {modelColors.map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={[
                                styles.filterChip,
                                { backgroundColor: filters.model_color_id === c.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                                filters.model_color_id === c.id.toString() && styles.filterChipActive,
                              ]}
                              onPress={() => setFilters(prev => ({ ...prev, model_color_id: c.id.toString() }))}
                            >
                              <Text style={[styles.filterChipText, { color: filters.model_color_id === c.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                                {c.display_name || c.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Condition Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.condition')}</Text>
                <ScrollView
                  ref={conditionScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipContainer}
                  onLayout={() => {
                    if (isRTL && conditionScrollRef.current) {
                      setTimeout(() => conditionScrollRef.current?.scrollToEnd({ animated: false }), 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...conditions].reverse().map((condition) => (
                        <TouchableOpacity
                          key={condition.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.condition_id === condition.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.condition_id === condition.id.toString() && styles.filterChipActive,
                            { marginRight: 0, marginLeft: 8 },
                          ]}
                          onPress={() => setFilters(prev => ({ ...prev, condition_id: condition.id.toString() }))}
                        >
                          <Text style={[styles.filterChipText, { color: filters.condition_id === condition.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {(() => {
                              const k = condition.name?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                              const map = { new: t('conditions.new'), likenew: t('conditions.likeNew'), usedlikenew: t('conditions.usedlikenew'), usedgood: t('conditions.usedgood'), usedfair: t('conditions.usedfair'), excellent: t('conditions.excellent'), verygood: t('conditions.veryGood'), good: t('conditions.good'), fair: t('conditions.fair'), poor: t('conditions.poor'), used: t('conditions.used'), refurbished: t('conditions.refurbished') };
                              return map[k] || condition.name || '';
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.condition_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.condition_id === '' && styles.filterChipActive,
                          { marginRight: 0, marginLeft: 8 },
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, condition_id: '' }))}
                      >
                        <Text style={[styles.filterChipText, { color: filters.condition_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.condition_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.condition_id === '' && styles.filterChipActive,
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, condition_id: '' }))}
                      >
                        <Text style={[styles.filterChipText, { color: filters.condition_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {conditions.map((condition) => (
                        <TouchableOpacity
                          key={condition.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.condition_id === condition.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.condition_id === condition.id.toString() && styles.filterChipActive,
                          ]}
                          onPress={() => setFilters(prev => ({ ...prev, condition_id: condition.id.toString() }))}
                        >
                          <Text style={[styles.filterChipText, { color: filters.condition_id === condition.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {(() => {
                              const k = condition.name?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                              const map = { new: t('conditions.new'), likenew: t('conditions.likeNew'), usedlikenew: t('conditions.usedlikenew'), usedgood: t('conditions.usedgood'), usedfair: t('conditions.usedfair'), excellent: t('conditions.excellent'), verygood: t('conditions.veryGood'), good: t('conditions.good'), fair: t('conditions.fair'), poor: t('conditions.poor'), used: t('conditions.used'), refurbished: t('conditions.refurbished') };
                              return map[k] || condition.name || '';
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Price Range Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.filterLabelRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.priceRange')}</Text>
                  {(filters.min_price || filters.max_price) && (
                    <TouchableOpacity
                      onPress={() => setFilters(prev => ({ ...prev, min_price: '', max_price: '' }))}
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
                      value={filters.min_price}
                      onChangeText={(text) => setFilters(prev => ({ ...prev, min_price: text }))}
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
                      value={filters.max_price}
                      onChangeText={(text) => setFilters(prev => ({ ...prev, max_price: text }))}
                    />
                  </View>
                </View>
              </View>

              {/* Battery Filter — only for phones category */}
              {(() => {
                const selectedCat = categories.find(c => c.id.toString() === filters.category_id);
                if (!selectedCat || selectedCat.slug !== 'phones') return null;
                return (
                  <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                    <View style={[styles.filterLabelRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                        {t('home.batteryHealth') || 'Battery Health (%)'}
                      </Text>
                      {(filters.min_battery || filters.max_battery) && (
                        <TouchableOpacity
                          onPress={() => setFilters(prev => ({ ...prev, min_battery: '', max_battery: '' }))}
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
                          value={filters.min_battery}
                          onChangeText={(text) => setFilters(prev => ({ ...prev, min_battery: text }))}
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
                          value={filters.max_battery}
                          onChangeText={(text) => setFilters(prev => ({ ...prev, max_battery: text }))}
                        />
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* City Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t('home.city') || 'City'}
                </Text>
                <ScrollView
                  ref={cityScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipContainer}
                  onLayout={() => {
                    if (isRTL && cityScrollRef.current) {
                      setTimeout(() => cityScrollRef.current?.scrollToEnd({ animated: false }), 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...cities].reverse().map((city) => (
                        <TouchableOpacity
                          key={city.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.city_id === city.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.city_id === city.id.toString() && styles.filterChipActive,
                            { marginRight: 0, marginLeft: 8 },
                          ]}
                          onPress={() => handleSelectCity(city.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.city_id === city.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {localizedPlaceName(city, language)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.city_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.city_id === '' && styles.filterChipActive,
                          { marginRight: 0, marginLeft: 8 },
                        ]}
                        onPress={() => handleSelectCity('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.city_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.city_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.city_id === '' && styles.filterChipActive,
                        ]}
                        onPress={() => handleSelectCity('')}
                      >
                        <Text style={[styles.filterChipText, { color: filters.city_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {cities.map((city) => (
                        <TouchableOpacity
                          key={city.id}
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.city_id === city.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.city_id === city.id.toString() && styles.filterChipActive,
                          ]}
                          onPress={() => handleSelectCity(city.id.toString())}
                        >
                          <Text style={[styles.filterChipText, { color: filters.city_id === city.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {localizedPlaceName(city, language)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Area Filter — only when city selected */}
              {filters.city_id !== '' && areas.length > 0 && (
                <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {t('home.area') || 'Area'}
                  </Text>
                  <ScrollView
                    ref={areaScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipContainer}
                    onLayout={() => {
                      if (isRTL && areaScrollRef.current) {
                        setTimeout(() => areaScrollRef.current?.scrollToEnd({ animated: false }), 50);
                      }
                    }}
                  >
                    {isRTL ? (
                      <>
                        {[...areas].reverse().map((area) => (
                          <TouchableOpacity
                            key={area.id}
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.area_id === area.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.area_id === area.id.toString() && styles.filterChipActive,
                              { marginRight: 0, marginLeft: 8 },
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, area_id: area.id.toString() }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.area_id === area.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {localizedPlaceName(area, language)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.area_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.area_id === '' && styles.filterChipActive,
                            { marginRight: 0, marginLeft: 8 },
                          ]}
                          onPress={() => setFilters(prev => ({ ...prev, area_id: '' }))}
                        >
                          <Text style={[styles.filterChipText, { color: filters.area_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {t('home.all')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.filterChip,
                            { backgroundColor: filters.area_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.area_id === '' && styles.filterChipActive,
                          ]}
                          onPress={() => setFilters(prev => ({ ...prev, area_id: '' }))}
                        >
                          <Text style={[styles.filterChipText, { color: filters.area_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {t('home.all')}
                          </Text>
                        </TouchableOpacity>
                        {areas.map((area) => (
                          <TouchableOpacity
                            key={area.id}
                            style={[
                              styles.filterChip,
                              { backgroundColor: filters.area_id === area.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                              filters.area_id === area.id.toString() && styles.filterChipActive,
                            ]}
                            onPress={() => setFilters(prev => ({ ...prev, area_id: area.id.toString() }))}
                          >
                            <Text style={[styles.filterChipText, { color: filters.area_id === area.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                              {localizedPlaceName(area, language)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Sort Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t('home.sort') || 'Sort'}
                </Text>
                <ScrollView
                  ref={sortScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipContainer}
                  onLayout={() => {
                    if (isRTL && sortScrollRef.current) {
                      setTimeout(() => sortScrollRef.current?.scrollToEnd({ animated: false }), 50);
                    }
                  }}
                >
                  {(() => {
                    const sortOptions = [
                      { value: 'newest', label: t('home.newest') || 'Newest' },
                      { value: 'oldest', label: t('home.oldest') || 'Oldest' },
                      { value: 'price_asc', label: t('home.lowestPrice') || 'Lowest Price' },
                      { value: 'price_desc', label: t('home.highestPrice') || 'Highest Price' },
                    ];
                    const items = isRTL ? [...sortOptions].reverse() : sortOptions;
                    return items.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterChip,
                          { backgroundColor: filters.sort === opt.value ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.sort === opt.value && styles.filterChipActive,
                          isRTL ? { marginRight: 0, marginLeft: 8 } : {},
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, sort: opt.value }))}
                      >
                        <Text style={[styles.filterChipText, { color: filters.sort === opt.value ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View style={[styles.filterActions, { borderTopColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                onPress={handleClearFilters}
              >
                <Text style={[styles.clearButtonText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('home.clearAll')}</Text>
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

      {/* Burger Menu Modal */}
      <Modal
        visible={showMenu}
        animationType="none"
        transparent={true}
        onRequestClose={handleCloseMenu}
        onShow={() => {
          // Refresh user name when menu opens
          fetchAdminStatus();
          // Reset animation value based on RTL
          menuSlideAnim.setValue(isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH);
          // Animate menu sliding in (from right in LTR, from left in RTL)
          Animated.timing(menuSlideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }}
      >
        <TouchableOpacity 
          style={[styles.menuOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={handleCloseMenu}
        >
          <Animated.View 
            style={[
              styles.menuContainer,
              {
                transform: [{ translateX: menuSlideAnim }],
                backgroundColor: colors.surface,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.menuHeader, { paddingTop: Math.max(insets.top, 16), backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.menuUserInfo, getFlexDirection(isRTL, 'row')]}>
              <View style={[styles.menuAvatar, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }]}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
              <View style={styles.menuUserTextContainer}>
                <Text style={[styles.menuUserName, { color: colors.text }, getTextAlign(isRTL, 'auto')]} numberOfLines={1}>
                  {userName || 'User'}
                </Text>
                <Text style={[styles.menuUserSubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('profile.welcomeBack')}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.menuCloseButton, { backgroundColor: colors.inputBackground }]}
              onPress={handleCloseMenu}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.menuContentWrapper, { backgroundColor: colors.surface }]}>
              <ScrollView 
                style={styles.menuContent}
                showsVerticalScrollIndicator={false}
              >
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleCloseMenu();
                    // Already on Home screen
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    <Ionicons name="home" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.home')}</Text>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleCloseMenu();
                    navigation.navigate('UserGuide');
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    <Ionicons name="book" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.userGuide')}</Text>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleCloseMenu();
                    navigation.navigate('PrivacyPolicy');
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.privacyPolicy')}</Text>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleCloseMenu();
                    navigation.navigate('TermsOfUse');
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    <Ionicons name="document-text" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.termsOfUse')}</Text>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleCloseMenu();
                    navigation.navigate('Help');
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    <Ionicons name="help-circle" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.help')}</Text>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.menuLanguageSection, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                    {t('settings.language')}
                  </Text>
                  <View style={[styles.menuLanguageButtons, getFlexDirection(isRTL, 'row')]}>
                    <TouchableOpacity
                      style={[
                        styles.menuLanguageButton,
                        {
                          backgroundColor: language === 'en' ? colors.primary : colors.inputBackground,
                          borderColor: language === 'en' ? colors.primary : colors.inputBorder,
                        },
                      ]}
                      onPress={() => changeLanguage('en')}
                    >
                      <Text
                        style={[
                          styles.menuLanguageButtonText,
                          { color: language === 'en' ? '#ffffff' : colors.text },
                        ]}
                      >
                        EN
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.menuLanguageButton,
                        {
                          backgroundColor: language === 'ar' ? colors.primary : colors.inputBackground,
                          borderColor: language === 'ar' ? colors.primary : colors.inputBorder,
                        },
                      ]}
                      onPress={() => changeLanguage('ar')}
                    >
                      <Text
                        style={[
                          styles.menuLanguageButtonText,
                          { color: language === 'ar' ? '#ffffff' : colors.text },
                        ]}
                      >
                        AR
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isAdmin && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemLast, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => {
                      handleCloseMenu();
                      navigation.navigate('AdminDashboard');
                    }}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                      <Ionicons name="shield" size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.menuItemText, { color: colors.text, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.adminDashboard')}</Text>
                    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </ScrollView>

              <View style={[styles.menuLogoutContainer, { 
                borderTopColor: isDarkMode ? colors.borderLight : colors.error,
                backgroundColor: isDarkMode ? '#ffffff' : colors.error 
              }]}>
                <TouchableOpacity
                  style={[styles.menuLogoutButton, { backgroundColor: isDarkMode ? '#ffffff' : 'transparent' }, getFlexDirection(isRTL, 'row')]}
                  onPress={() => {
                    handleLogout();
                  }}
                >
                  <Ionicons name="log-out" size={24} color={isDarkMode ? '#09090b' : '#ffffff'} />
                  <Text style={[styles.menuLogoutButtonText, { color: isDarkMode ? '#09090b' : '#ffffff', marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }, getTextAlign(isRTL, 'auto')]}>{t('profile.logout')}</Text>
                </TouchableOpacity>
              </View>
          </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 24, // p-6
    paddingBottom: 8, // pb-2
    borderBottomWidth: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16, // mb-4
  },
  headerTitle: {
    fontSize: 24, // text-2xl
    fontWeight: 'bold',
  },
  bellButton: {
    padding: 4,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainerFlex: {
    flex: 1,
    marginBottom: 0,
  },
  filterEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  filterEntryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterEntryBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterEntryBadgeText: {
    color: '#667eea',
    fontSize: 11,
    fontWeight: '700',
  },
  activeFiltersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  activeFiltersBarText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activeFiltersClearText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    paddingVertical: 12,
    paddingRight: 8,
  },
  searchClearButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  searchModalClearButton: {
    padding: 4,
    zIndex: 1,
  },
  searchModalContainer: {
    flex: 1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchModalInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    height: 44,
  },
  searchModalInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    paddingVertical: 12,
    paddingRight: 8,
  },
  searchModalCancelButton: {
    paddingVertical: 8,
  },
  searchModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchModalResults: {
    flex: 1,
  },
  searchModalResultsContent: {
    padding: 16,
  },
  searchLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  searchEmptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16, // p-4
    paddingBottom: 96, // pb-24 (for bottom nav)
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12, // mb-3
  },
  sectionTitle: {
    fontSize: 18, // text-lg
    fontWeight: '600',
    marginBottom: 16,
    color: '#09090b',
  },
  seeAllText: {
    color: '#667eea', // text-primary
    fontSize: 14, // text-sm
    fontWeight: '500',
  },
  categoriesScroll: {
    marginHorizontal: -16,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8, // pb-2
  },
  categoryItem: {
    alignItems: 'center',
    minWidth: 80,
    marginRight: 12, // gap-3 equivalent
  },
  categoryBox: {
    width: 80, // w-20
    height: 90, // h-22
    borderRadius: 16, // rounded-2xl
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    paddingVertical: 8,
  },
  categoryBoxActive: {
    borderWidth: 2,
  },
  brandLogo: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },
  brandLogoPlaceholder: {
    width: 40,
    height: 40,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  brandInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  categoryText: {
    fontSize: 11, // text-xs
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryTextActive: {
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8, // negative margin for gap
  },
  card: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16, // gap-4
    backgroundColor: '#ffffff',
    borderRadius: 16, // rounded-2xl
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardImageContainer: {
    height: 128, // h-32
    backgroundColor: '#e2e8f0', // bg-slate-200
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#71717a',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearFiltersButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  conditionBadge: {
    position: 'absolute',
    top: 8, // top-2
    right: 8, // right-2
    paddingHorizontal: 8, // px-2
    paddingVertical: 4, // py-1
    borderRadius: 6, // rounded-md
  },
  conditionText: {
    fontSize: 10, // text-[10px]
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  cardContent: {
    padding: 12, // p-3
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#09090b',
  },
  cardPrice: {
    color: '#667eea', // text-primary
    fontWeight: 'bold',
    marginTop: 4, // mt-1
    fontSize: 16,
  },
  bottomNav: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9', // border-slate-100
    padding: 16, // p-4
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 40, // rounded-b-[40px]
    borderBottomRightRadius: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  navItem: {
    alignItems: 'center',
  },
  navIconContainer: {
    position: 'relative',
  },
  navNotificationBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navNotificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  navLabel: {
    fontSize: 10, // text-[10px]
    fontWeight: '500',
    color: '#71717a', // text-muted-foreground
    marginTop: 4, // gap-1 equivalent
  },
  addButtonContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -28, // Raise the entire container up
  },
  addButton: {
    width: 56, // w-14
    height: 56, // h-14
    borderRadius: 28, // rounded-full
    backgroundColor: '#667eea', // bg-secondary (using primary)
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navLabelActive: {
    color: '#667eea', // text-primary
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#09090b',
  },
  filterScroll: {
    maxHeight: 500,
  },
  filterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#09090b',
    marginBottom: 12,
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
  chipContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#09090b',
    backgroundColor: '#f8fafc',
  },
  priceSeparator: {
    fontSize: 18,
    color: '#71717a',
    marginTop: 20,
  },
  filterActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  clearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#71717a',
  },
  applyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#667eea',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 4,
  },
  // Menu Styles
  menuOverlay: {
    flex: 1,
  },
  menuContainer: {
    flex: 1,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  menuButton: {
    padding: 4,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    minHeight: 80,
  },
  menuUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuUserTextContainer: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#09090b',
    marginBottom: 4,
  },
  menuUserSubtext: {
    fontSize: 15,
    color: '#71717a',
  },
  menuCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  menuContent: {
    flex: 1,
    paddingTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginHorizontal: 0,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 17,
    color: '#09090b',
    fontWeight: '500',
  },
  menuLanguageSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuLanguageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  menuLanguageButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLanguageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
    marginHorizontal: 0,
  },
  menuLogoutContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  menuLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  menuLogoutButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Ads Styles
  adsSection: {
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
  },
  adsBannerWrapper: {
    position: 'relative',
    height: 180,
  },
  adsScrollView: {
    marginHorizontal: -16, // Match brands ScrollView - extend to screen edges (cancel parent padding)
  },
  adsContainer: {
    paddingHorizontal: 16, // Match categoriesContainer - add padding back for content
  },
  adBanner: {
    width: SCREEN_WIDTH - 32, // Full width minus padding (16px on each side)
    height: 180,
    marginRight: 0,
  },
  adsBannerContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  adTouchable: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  adBadge: {
    position: 'absolute',
    top: 10,
    right: 26, // 16px content padding + 10px offset to align with content area
    backgroundColor: 'rgba(102, 126, 234, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  adBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 1,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  bannerDotActive: {
    width: 16,
  },
});
