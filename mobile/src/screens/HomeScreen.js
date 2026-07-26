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
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { API_BASE_URL } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState([]);
  const [storageOptions, setStorageOptions] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const brandScrollRef = useRef(null);
  const storageScrollRef = useRef(null);
  const conditionScrollRef = useRef(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  const [imageErrors, setImageErrors] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(isRTL ? -SCREEN_WIDTH : SCREEN_WIDTH)).current;
  const [ads, setAds] = useState([]);
  const [originalAdsCount, setOriginalAdsCount] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adsScrollRef = useRef(null);
  const adsAutoScrollInterval = useRef(null);
  const isScrollingRef = useRef(false);
  const pendingResetRef = useRef(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    brand_id: '',
    storage_id: '',
    condition_id: '',
    min_price: '',
    max_price: '',
  });

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

  const fetchUnreadCount = useCallback(async () => {
    try {
      // Respect push notification preference from Settings
      const pushPref = await AsyncStorage.getItem('pushNotificationsEnabled');
      if (pushPref === 'false') {
        setUnreadCount(0);
        return;
      }

      const pushNotificationsEnabled = await AsyncStorage.getItem('pushNotificationsEnabled');
      if (pushNotificationsEnabled === 'false') {
        setUnreadCount(0);
        return;
      }

      const response = await apiClient.get('/admin/notifications/unread-count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, []);

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

  const fetchAds = useCallback(async () => {
    try {
      const response = await apiClient.get('/ads');
      const fetchedAds = response.data.ads || [];
      
      // Store original count for infinite scroll calculations
      setOriginalAdsCount(fetchedAds.length);
      
      // For infinite scroll, duplicate the ads array multiple times
      // This allows seamless continuous scrolling
      const duplicatedAds = fetchedAds.length > 1 
        ? [...fetchedAds, ...fetchedAds, ...fetchedAds] // Triple for smooth infinite effect
        : fetchedAds;
      
      setAds(duplicatedAds);
      
      // Reset current index when ads change
      if (fetchedAds.length > 0) {
        // Start from the middle set (second copy) for infinite scroll effect
        const startIndex = fetchedAds.length;
        setCurrentAdIndex(startIndex);
        // Scroll to middle set (second copy) to enable infinite scrolling
        if (adsScrollRef.current && fetchedAds.length > 1) {
          const adWidth = SCREEN_WIDTH - 32;
          setTimeout(() => {
            adsScrollRef.current?.scrollTo({ 
              x: startIndex * adWidth, 
              animated: false 
            });
          }, 200);
        } else if (adsScrollRef.current) {
          adsScrollRef.current.scrollTo({ x: 0, animated: false });
        }
      }
    } catch (error) {
      console.error('Error fetching ads:', error);
      setAds([]);
      setOriginalAdsCount(0);
    }
  }, []);

  useEffect(() => {
    fetchFilterData();
    fetchUnreadCount();
    fetchAdminStatus();
    fetchAds();
  }, [fetchUnreadCount, fetchAdminStatus, fetchAds]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      fetchAdminStatus();
      fetchAds(); // Refresh ads when screen comes into focus
    }, [fetchUnreadCount, fetchAdminStatus, fetchAds])
  );

  // Refresh user name when screen comes into focus (e.g., after editing profile)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAdminStatus();
    });
    return unsubscribe;
  }, [navigation, fetchAdminStatus]);

  // Auto-scroll ads if there are multiple - infinite scroll (left to right continuously)
  useEffect(() => {
    // Wait a bit for the ScrollView to be ready
    const setupTimer = setTimeout(() => {
      if (originalAdsCount > 1 && adsScrollRef.current && ads.length > 0) {
        // Clear any existing interval
        if (adsAutoScrollInterval.current) {
          clearInterval(adsAutoScrollInterval.current);
        }

        // Set up infinite auto-scroll: continuously move left to right smoothly
        adsAutoScrollInterval.current = setInterval(() => {
          // Skip if user is manually scrolling or ref is not available
          if (isScrollingRef.current || !adsScrollRef.current) {
            return;
          }

          const adWidth = SCREEN_WIDTH - 32;
          
          setCurrentAdIndex((prevIndex) => {
            let nextIndex = prevIndex + 1;
            let scrollX = nextIndex * adWidth;
            
            // Always scroll with smooth animation for better UX
            // When scrolling to the third set (which looks like the first set),
            // it creates the illusion of smoothly looping back to the beginning
            if (adsScrollRef.current) {
              // Check if we're scrolling to the third set (infinite scroll boundary)
              if (nextIndex >= originalAdsCount * 2) {
                // Mark that we need to reset after this scroll completes
                pendingResetRef.current = true;
              }
              
              // Scroll smoothly to the next ad (or to third set which looks like first)
              adsScrollRef.current.scrollTo({
                x: scrollX,
                animated: true, // Always use smooth animation
              });
            }
            
            return nextIndex;
          });
        }, 4000); // 4 seconds per ad for smoother infinite scroll
      }
    }, 500); // Wait 500ms for ScrollView to be ready

    return () => {
      clearTimeout(setupTimer);
      if (adsAutoScrollInterval.current) {
        clearInterval(adsAutoScrollInterval.current);
      }
    };
  }, [originalAdsCount, ads.length]);

  // Handle scroll start - mark as manually scrolling
  const handleAdsScrollBeginDrag = () => {
    isScrollingRef.current = true;
  };

  // Handle scroll end - update index with infinite scroll reset logic
  // This is called when scroll animation completes (onMomentumScrollEnd)
  const handleAdsScrollEnd = (event) => {
    if (!event || !adsScrollRef.current) {
      isScrollingRef.current = false;
      pendingResetRef.current = false;
      return;
    }
    
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const adWidth = SCREEN_WIDTH - 32;
    let index = Math.round(scrollPosition / adWidth);
    
    // Check if we need to reset after smooth scroll to third set (infinite scroll boundary)
    if (pendingResetRef.current && originalAdsCount > 1 && index >= originalAdsCount * 2) {
      // Reset to the corresponding position in the middle set (second copy)
      // This happens after the smooth scroll animation has completed
      index = originalAdsCount + (index % originalAdsCount);
      adsScrollRef.current.scrollTo({
        x: index * adWidth,
        animated: false, // Silent reset - user has already seen the smooth transition
      });
      setCurrentAdIndex(index);
      pendingResetRef.current = false;
      isScrollingRef.current = false;
      return;
    }
    
    // Handle infinite scroll: if scrolled to first set, silently jump to middle set
    if (originalAdsCount > 1 && index < originalAdsCount) {
      index = originalAdsCount + index;
      adsScrollRef.current.scrollTo({
        x: index * adWidth,
        animated: false, // Silent jump
      });
      setCurrentAdIndex(index);
      isScrollingRef.current = false;
      return;
    }
    
    // Clear pending reset flag if we're in the middle set
    if (index >= originalAdsCount && index < originalAdsCount * 2) {
      pendingResetRef.current = false;
    }
    
    // Update index normally
    setCurrentAdIndex(index);
    
    // Reset scrolling flag to allow auto-scroll to continue
    isScrollingRef.current = false;
  };

  const fetchFilterData = async () => {
    try {
      const [brandsRes, storageRes, conditionsRes] = await Promise.all([
        apiClient.get('/brands'),
        apiClient.get('/storage'),
        apiClient.get('/conditions'),
      ]);
      
      // Sort brands to ensure Samsung appears second
      const brandsList = brandsRes.data.brands || [];
      const sortedBrands = [...brandsList].sort((a, b) => {
        // Apple first
        if (a.name.toLowerCase() === 'apple') return -1;
        if (b.name.toLowerCase() === 'apple') return 1;
        
        // Samsung second
        if (a.name.toLowerCase() === 'samsung') return -1;
        if (b.name.toLowerCase() === 'samsung') return 1;
        
        // Everything else alphabetically
        return a.name.localeCompare(b.name);
      });
      
      setBrands(sortedBrands);
      setStorageOptions(storageRes.data.storage || []);
      setConditions(conditionsRes.data.conditions || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  // Fetch search results without affecting main listings
  const fetchSearchResults = React.useCallback(async (search = '', appliedFilters = {}) => {
    try {
      const params = new URLSearchParams({
        status: 'approved',
        limit: '20',
      });
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      // Apply filters
      if (appliedFilters.brand_id) {
        params.append('brand_id', appliedFilters.brand_id);
      }
      if (appliedFilters.storage_id) {
        params.append('storage_id', appliedFilters.storage_id);
      }
      if (appliedFilters.condition_id) {
        params.append('condition_id', appliedFilters.condition_id);
      }
      if (appliedFilters.min_price) {
        params.append('min_price', appliedFilters.min_price);
      }
      if (appliedFilters.max_price) {
        params.append('max_price', appliedFilters.max_price);
      }

      const response = await apiClient.get(`/listings?${params.toString()}`);
      const fetchedListings = response.data.listings || [];
      return fetchedListings;
    } catch (error) {
      console.error('Error fetching search results:', error);
      return [];
    }
  }, []);

  const fetchListings = React.useCallback(async (search = '', appliedFilters = {}) => {
    try {
      const params = new URLSearchParams({
        status: 'approved',
        limit: '20',
      });
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      // Apply filters
      if (appliedFilters.brand_id) {
        params.append('brand_id', appliedFilters.brand_id);
      }
      if (appliedFilters.storage_id) {
        params.append('storage_id', appliedFilters.storage_id);
      }
      if (appliedFilters.condition_id) {
        params.append('condition_id', appliedFilters.condition_id);
      }
      if (appliedFilters.min_price) {
        params.append('min_price', appliedFilters.min_price);
      }
      if (appliedFilters.max_price) {
        params.append('max_price', appliedFilters.max_price);
      }

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

  useEffect(() => {
    fetchListings(searchQuery, filters);
  }, [fetchListings, searchQuery, filters]);

  useFocusEffect(
    React.useCallback(() => {
      fetchListings(searchQuery, filters);
    }, [fetchListings, searchQuery, filters])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings(searchQuery, filters);
    fetchAds(); // Also refresh ads on pull-to-refresh
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    fetchListings(searchQuery, filters);
  };

  const handleSearchModalOpen = () => {
    // Always start with empty search in modal - don't copy main searchQuery
    setSearchModalQuery('');
    setSearchResults([]);
    setShowSearchModal(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  };

  const handleSearchModalClose = () => {
    Keyboard.dismiss();
    setShowSearchModal(false);
    setSearchModalQuery('');
    setSearchResults([]);
  };

  const handleSearchModalChange = async (text) => {
    setSearchModalQuery(text);
    if (text.trim()) {
      setSearchLoading(true);
      try {
        // Use fetchSearchResults to avoid affecting main listings
        const results = await fetchSearchResults(text, filters);
        setSearchResults(results);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const handleSearchModalSubmit = () => {
    // Just dismiss keyboard - search is already performed via handleSearchModalChange
    Keyboard.dismiss();
  };

  const handleSearchResultPress = (listingId) => {
    handleSearchModalClose();
    handleListingPress(listingId);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.brand_id) count++;
    if (filters.storage_id) count++;
    if (filters.condition_id) count++;
    if (filters.min_price) count++;
    if (filters.max_price) count++;
    return count;
  };

  const handleApplyFilters = () => {
    setShowFilterModal(false);
    setLoading(true);
    fetchListings(searchQuery, filters);
  };

  const handleClearFilters = () => {
    setFilters({
      brand_id: '',
      storage_id: '',
      condition_id: '',
      min_price: '',
      max_price: '',
    });
    setShowFilterModal(false);
    setLoading(true);
    fetchListings(searchQuery, {
      brand_id: '',
      storage_id: '',
      condition_id: '',
      min_price: '',
      max_price: '',
    });
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
              <View style={styles.languageButtons}>
                <TouchableOpacity
                  style={[
                    styles.languageButton,
                    { backgroundColor: language === 'en' ? colors.primary : colors.inputBackground },
                  ]}
                  onPress={() => changeLanguage('en')}
                >
                  <Text style={[
                    styles.languageButtonText,
                    { color: language === 'en' ? '#ffffff' : colors.text }
                  ]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageButton,
                    { backgroundColor: language === 'ar' ? colors.primary : colors.inputBackground },
                  ]}
                  onPress={() => changeLanguage('ar')}
                >
                  <Text style={[
                    styles.languageButtonText,
                    { color: language === 'ar' ? '#ffffff' : colors.text }
                  ]}>AR</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons name="funnel-outline" size={24} color={colors.primary} />
                {getActiveFiltersCount() > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => setShowMenu(true)}
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={handleSearchModalOpen}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <Text style={[styles.searchInput, { color: searchQuery ? colors.text : colors.textSecondary }]}>
              {searchQuery || t('home.searchMobiles')}
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  fetchListings('', filters);
                }}
                style={styles.searchClearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
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
          {/* Ads Banner */}
          {ads.length > 0 && (
            <View style={styles.adsSection}>
              <View style={styles.adsBannerWrapper}>
                <ScrollView 
                  ref={adsScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled
                  scrollEnabled={originalAdsCount > 1}
                  onScrollBeginDrag={handleAdsScrollBeginDrag}
                  onMomentumScrollEnd={handleAdsScrollEnd}
                  onScrollEndDrag={handleAdsScrollEnd}
                  scrollEventThrottle={16}
                  decelerationRate={0.98}
                  snapToInterval={SCREEN_WIDTH - 32}
                  snapToAlignment="start"
                  bounces={false}
                  style={styles.adsScrollView}
                  contentContainerStyle={styles.adsContainer}
                >
                  {ads.map((ad, index) => (
                    <View key={`${ad.id}-${index}`} style={styles.adBanner}>
                      <View style={styles.adsBannerContainer}>
                        <TouchableOpacity
                          style={styles.adTouchable}
                          onPress={async () => {
                            if (ad.link_url) {
                              try {
                                const url = ad.link_url.startsWith('http://') || ad.link_url.startsWith('https://')
                                  ? ad.link_url
                                  : `https://${ad.link_url}`;
                                const canOpen = await Linking.canOpenURL(url);
                                if (canOpen) {
                                  await Linking.openURL(url);
                                } else {
                                  Alert.alert('Error', 'Unable to open this link');
                                }
                              } catch (error) {
                                console.error('Error opening link:', error);
                                Alert.alert('Error', 'Failed to open link');
                              }
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: ad.image_url }}
                            style={styles.adImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {/* Fixed AD badge - positioned outside scroll view */}
                <View style={styles.adBadge}>
                  <Ionicons name="megaphone" size={12} color="#ffffff" />
                  <Text style={styles.adBadgeText}>AD</Text>
                </View>
              </View>
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
                    // Toggle brand filter - if already selected, deselect it
                    const isCurrentlySelected = filters.brand_id === brand.id.toString();
                    const newFilters = { 
                      ...filters, 
                      brand_id: isCurrentlySelected ? '' : brand.id.toString() 
                    };
                    setFilters(newFilters);
                    setLoading(true);
                    fetchListings(searchQuery, newFilters);
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
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('home.noListings')}</Text>
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
          // Scroll to the end in RTL mode so "All" (which is last in array) is visible on the right immediately
          if (isRTL) {
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
              setTimeout(() => {
                if (brandScrollRef.current) {
                  brandScrollRef.current.scrollToEnd({ animated: false });
                }
                if (storageScrollRef.current) {
                  storageScrollRef.current.scrollToEnd({ animated: false });
                }
                if (conditionScrollRef.current) {
                  conditionScrollRef.current.scrollToEnd({ animated: false });
                }
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
              {/* Brand Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.brand')}</Text>
                <ScrollView 
                  ref={brandScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.chipContainer}
                  onLayout={() => {
                    // Scroll to end when layout is ready in RTL mode
                    if (isRTL && brandScrollRef.current) {
                      setTimeout(() => {
                        brandScrollRef.current?.scrollToEnd({ animated: false });
                      }, 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...brands].reverse().map((brand) => (
                        <TouchableOpacity
                          key={brand.id}
                          style={[
                            styles.filterChip, 
                            { backgroundColor: filters.brand_id === brand.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.brand_id === brand.id.toString() && styles.filterChipActive,
                            { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                          ]}
                          onPress={() => setFilters({ ...filters, brand_id: brand.id.toString() })}
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
                          { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                        ]}
                        onPress={() => setFilters({ ...filters, brand_id: '' })}
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
                          filters.brand_id === '' && styles.filterChipActive
                        ]}
                        onPress={() => setFilters({ ...filters, brand_id: '' })}
                      >
                        <Text style={[styles.filterChipText, { color: filters.brand_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {brands.map((brand) => (
                        <TouchableOpacity
                          key={brand.id}
                          style={[
                            styles.filterChip, 
                            { backgroundColor: filters.brand_id === brand.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.brand_id === brand.id.toString() && styles.filterChipActive
                          ]}
                          onPress={() => setFilters({ ...filters, brand_id: brand.id.toString() })}
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

              {/* Storage Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.storage')}</Text>
                <ScrollView 
                  ref={storageScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.chipContainer}
                  onLayout={() => {
                    // Scroll to end when layout is ready in RTL mode
                    if (isRTL && storageScrollRef.current) {
                      setTimeout(() => {
                        storageScrollRef.current?.scrollToEnd({ animated: false });
                      }, 50);
                    }
                  }}
                >
                  {isRTL ? (
                    <>
                      {[...storageOptions].reverse().map((storage) => (
                        <TouchableOpacity
                          key={storage.id}
                          style={[
                            styles.filterChip, 
                            { backgroundColor: filters.storage_id === storage.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.storage_id === storage.id.toString() && styles.filterChipActive,
                            { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                          ]}
                          onPress={() => setFilters({ ...filters, storage_id: storage.id.toString() })}
                        >
                          <Text style={[styles.filterChipText, { color: filters.storage_id === storage.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {storage.capacity_gb} GB
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.filterChip, 
                          { backgroundColor: filters.storage_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.storage_id === '' && styles.filterChipActive,
                          { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                        ]}
                        onPress={() => setFilters({ ...filters, storage_id: '' })}
                      >
                        <Text style={[styles.filterChipText, { color: filters.storage_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterChip, 
                          { backgroundColor: filters.storage_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.storage_id === '' && styles.filterChipActive
                        ]}
                        onPress={() => setFilters({ ...filters, storage_id: '' })}
                      >
                        <Text style={[styles.filterChipText, { color: filters.storage_id === '' ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                          {t('home.all')}
                        </Text>
                      </TouchableOpacity>
                      {storageOptions.map((storage) => (
                        <TouchableOpacity
                          key={storage.id}
                          style={[
                            styles.filterChip, 
                            { backgroundColor: filters.storage_id === storage.id.toString() ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                            filters.storage_id === storage.id.toString() && styles.filterChipActive
                          ]}
                          onPress={() => setFilters({ ...filters, storage_id: storage.id.toString() })}
                        >
                          <Text style={[styles.filterChipText, { color: filters.storage_id === storage.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
                            {storage.capacity_gb} GB
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Condition Filter */}
              <View style={[styles.filterSection, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.filterLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('home.condition')}</Text>
                <ScrollView 
                  ref={conditionScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.chipContainer}
                  onLayout={() => {
                    // Scroll to end when layout is ready in RTL mode
                    if (isRTL && conditionScrollRef.current) {
                      setTimeout(() => {
                        conditionScrollRef.current?.scrollToEnd({ animated: false });
                      }, 50);
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
                            { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                          ]}
                          onPress={() => setFilters({ ...filters, condition_id: condition.id.toString() })}
                        >
                          <Text style={[styles.filterChipText, { color: filters.condition_id === condition.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
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
                      <TouchableOpacity
                        style={[
                          styles.filterChip, 
                          { backgroundColor: filters.condition_id === '' ? colors.primary : colors.inputBackground, borderColor: colors.inputBorder },
                          filters.condition_id === '' && styles.filterChipActive,
                          { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                        ]}
                        onPress={() => setFilters({ ...filters, condition_id: '' })}
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
                          filters.condition_id === '' && styles.filterChipActive
                        ]}
                        onPress={() => setFilters({ ...filters, condition_id: '' })}
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
                            filters.condition_id === condition.id.toString() && styles.filterChipActive
                          ]}
                          onPress={() => setFilters({ ...filters, condition_id: condition.id.toString() })}
                        >
                          <Text style={[styles.filterChipText, { color: filters.condition_id === condition.id.toString() ? '#ffffff' : colors.text }, getTextAlign(isRTL, 'center')]}>
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
                      onPress={() => {
                        setFilters({ ...filters, min_price: '', max_price: '' });
                      }}
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
                      onChangeText={(text) => setFilters({ ...filters, min_price: text })}
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
                      onChangeText={(text) => setFilters({ ...filters, max_price: text })}
                    />
                  </View>
                </View>
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

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleSearchModalClose}
      >
        <View style={[styles.searchModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          {/* Search Header */}
          <View style={[styles.searchModalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
            <View style={[styles.searchModalInputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchModalInput, { color: colors.text }]}
                placeholder="Search mobiles..."
                placeholderTextColor={colors.textSecondary}
                value={searchModalQuery}
                onChangeText={handleSearchModalChange}
                onSubmitEditing={handleSearchModalSubmit}
                returnKeyType="search"
                autoFocus
              />
              {searchModalQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => handleSearchModalChange('')}
                  style={styles.searchModalClearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSearchModalClose}
              style={styles.searchModalCancelButton}
            >
              <Text style={[styles.searchModalCancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          <ScrollView
            style={styles.searchModalResults}
            contentContainerStyle={styles.searchModalResultsContent}
            keyboardShouldPersistTaps="handled"
          >
            {searchLoading ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : searchModalQuery.trim() && searchResults.length === 0 ? (
              <View style={styles.searchEmptyContainer}>
                <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.searchEmptyText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('home.noSearchResults')}</Text>
                <Text style={[styles.searchEmptySubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
                  {t('home.tryDifferentKeywords')}
                </Text>
              </View>
            ) : !searchModalQuery.trim() ? (
              <View style={styles.searchEmptyContainer}>
                <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.searchEmptyText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('home.startTypingToSearch')}</Text>
                <Text style={[styles.searchEmptySubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
                  {t('home.searchForPhones')}
                </Text>
              </View>
            ) : (
              <View style={styles.searchResultsGrid}>
                {searchResults.map((listing) => (
                  <TouchableOpacity
                    key={listing.id}
                    style={[styles.card, { backgroundColor: colors.surface }]}
                    onPress={() => handleSearchResultPress(listing.id)}
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
          </ScrollView>
        </View>
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
    gap: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 4,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  filterButton: {
    padding: 4,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
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
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
  },
  adsBannerWrapper: {
    position: 'relative',
    height: 220,
  },
  adsScrollView: {
    marginHorizontal: -16, // Match brands ScrollView - extend to screen edges (cancel parent padding)
  },
  adsContainer: {
    paddingHorizontal: 16, // Match categoriesContainer - add padding back for content
  },
  adBanner: {
    width: SCREEN_WIDTH - 32, // Full width minus padding (16px on each side)
    height: 220,
    marginRight: 0,
  },
  adsBannerContainer: {
    width: '100%',
    height: 220,
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
});
