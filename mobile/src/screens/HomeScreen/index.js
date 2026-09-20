import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../../utils/api';
import { logApiError, withNetworkRetry } from '../../utils/apiError';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../../utils/rtlStyles';
import {
  EMPTY_MARKETPLACE_FILTERS,
  countActiveMarketplaceFilters,
} from '../../utils/marketplaceFilters';
import { filterMvpCategories } from '../../utils/mvpCategories';
import { handleBannerAction } from '../../utils/bannerActions';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useOffersUnread } from '../../context/OffersUnreadContext';
import NavBadge from '../../components/NavBadge';
import { fonts, radii, space } from '../../utils/designTokens';
import HomeListingCard from './HomeListingCard';
import HomeBottomNav from './HomeBottomNav';
import MarketplaceFiltersSheet from './MarketplaceFiltersSheet';
import { useHomeMarketplace } from './useHomeMarketplace';
import {
  EmptyState,
  MarketplaceCardSkeleton,
} from '../../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const { loadFavorites } = useFavorites();
  // Badge count is shared with the Notifications screen so both stay in sync.
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const { unreadOffersCount, refreshUnreadOffersCount } = useOffersUnread();
  const {
    listings,
    loading,
    listingsLoadError,
    refreshing,
    searchQuery,
    debouncedSearchQuery,
    searchInputRef,
    filters,
    setFilters,
    loadingMore,
    fetchListings,
    refreshListings,
    handleLoadMoreListings,
    handleSearchChange,
    handleClearSearch,
    setLoading,
  } = useHomeMarketplace();
  const [brands, setBrands] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [banners, setBanners] = useState([]);
  const [originalBannerCount, setOriginalBannerCount] = useState(0);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannersScrollRef = useRef(null);
  const bannersAutoScrollInterval = useRef(null);
  const isScrollingRef = useRef(false);
  const pendingResetRef = useRef(false);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await withNetworkRetry(() => apiClient.get('/user/profile'));
      const profile = response.data?.user;
      if (!profile) {
        return;
      }
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      if (fullName) {
        setUserName(fullName);
      }
      if (profile.id != null) {
        setCurrentUserId(profile.id);
      }
    } catch (error) {
      if (
        error?.isMaintenance ||
        error?.name === 'MaintenanceError' ||
        error?.code === 'ERR_MAINTENANCE' ||
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError'
      ) {
        return;
      }
      logApiError('HomeScreen.fetchUserProfile', error);
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const response = await withNetworkRetry(() => apiClient.get('/banners'));
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
      if (error?.isMaintenance || error?.name === 'MaintenanceError') return;
      // Banner failures must not block Home listings
      logApiError('HomeScreen.fetchBanners', error);
      setBanners([]);
      setOriginalBannerCount(0);
    }
  }, []);

  useEffect(() => {
    fetchFilterData();
    // Cached in FavoritesContext, so this only hits the API once per session.
    loadFavorites();
  }, [loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
      refreshUnreadOffersCount();
      fetchUserProfile();
      fetchBanners();
    }, [refreshUnreadCount, refreshUnreadOffersCount, fetchUserProfile, fetchBanners])
  );

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
      setCategories(filterMvpCategories(categoriesRes.data.categories || []));
      setConditions(conditionsRes.data.conditions || []);
      setCities(citiesRes.data.cities || []);
    } catch (error) {
      if (
        error?.isMaintenance ||
        error?.name === 'MaintenanceError' ||
        error?.code === 'ERR_MAINTENANCE'
      ) {
        return;
      }
      logApiError('HomeScreen.fetchFilterData', error);
    }
  };

  const onRefresh = () => {
    refreshListings();
    fetchBanners();
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

  const openFilterModal = () => {
    setShowFilterModal(true);
  };

  const handleClearFilters = () => {
    const cleared = { ...EMPTY_MARKETPLACE_FILTERS };
    setFilters(cleared);
    setShowFilterModal(false);
  };

  const handleListingPress = (listingId) => {
    navigation.navigate('ListingDetails', { listingId });
  };

  const handleCreateListing = () => {
    navigation.navigate('CreateListing');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        {/* Header — avatar → Profile | brand | notifications bell */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={[styles.headerTop, getFlexDirection(isRTL, 'row')]}>
            <TouchableOpacity
              style={[styles.headerAvatar, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel={t('home.profileNav')}
            >
              <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
                {userName ? userName.charAt(0).toUpperCase() : ''}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
              {t('home.telefonak')}
            </Text>
            <View style={[styles.headerRight, getFlexDirection(isRTL, 'row')]}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel={t('home.notifications')}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
                <NavBadge count={unreadCount} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.searchFilterRow, getFlexDirection(isRTL, 'row')]}>
            <View
              style={[
                styles.searchContainer,
                styles.searchContainerFlex,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.border,
                },
              ]}
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
                styles.filterPill,
                {
                  backgroundColor:
                    getActiveFiltersCount() > 0 ? colors.primary : colors.surfaceContainerLow,
                },
              ]}
              onPress={openFilterModal}
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
                  styles.filterPillText,
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
        </View>

        {/* Scrollable marketplace: banners/brands header + paginated listings */}
        <FlatList
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={listings}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.listingsRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={handleLoadMoreListings}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <>
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
                            source={{ uri: resolveMediaUrl(banner.image_url) }}
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

          {/* Latest public marketplace listings */}
          <View style={styles.listingsSectionHeader}>
            <Text
              style={[
                styles.sectionHeading,
                { color: colors.text },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.latestListings')}
            </Text>
            {loading && listings.length === 0 ? (
              <View style={styles.listingSkeletonGrid}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <MarketplaceCardSkeleton key={index} imageHeight={120} />
                ))}
              </View>
            ) : null}
          </View>
            </>
          }
          ListEmptyComponent={
            !loading ? (
              listingsLoadError ? (
                <EmptyState
                  icon="cloud-offline-outline"
                  title={t('common.error')}
                  description={t('common.somethingWentWrong')}
                  actionLabel={t('common.retry')}
                  onAction={() => {
                    setLoading(true);
                    fetchListings(debouncedSearchQuery, filters);
                  }}
                />
              ) : (
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
              )
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item: listing }) => (
            <HomeListingCard
              listing={listing}
              isOwn={
                currentUserId == null ||
                String(listing.user_id) === String(currentUserId)
              }
              onPress={() => handleListingPress(listing.id)}
            />
          )}
        />

        {/* Bottom Nav: Home | Listings | Sell | Offers | Saved */}
        <HomeBottomNav
          unreadOffersCount={unreadOffersCount}
          onSell={handleCreateListing}
        />
      </View>

      <MarketplaceFiltersSheet
        visible={showFilterModal}
        appliedFilters={filters}
        brands={brands}
        categories={categories}
        conditions={conditions}
        cities={cities}
        onClose={() => setShowFilterModal(false)}
        onApply={(nextFilters) => setFilters(nextFilters)}
      />
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
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  bellButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontFamily: fonts.labelBold,
    color: '#ffffff',
    fontSize: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontFamily: fonts.labelBold,
    fontSize: 15,
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
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  filterPillText: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
  filterEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  filterEntryButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
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
    fontFamily: fonts.labelBold,
    color: '#1976D2',
    fontSize: 11,
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
    paddingBottom: 120, // space for floating bottom nav
  },
  listingsSectionHeader: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: fonts.headline,
    fontSize: 18,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8, // negative margin for gap
  },
  listingsRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
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
  // Menu Styles
  menuOverlay: {
    flex: 1,
  },
  menuContainer: {
    flex: 1,
    width: '100%',
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 1,
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
    minHeight: 44,
    // Keep a small gap from the close button so taps don't overlap.
    marginEnd: 8,
  },
  menuUserInfoPressed: {
    opacity: 0.7,
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
    color: '#1a1c1c',
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
  menuContentContainer: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 8,
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
    color: '#1a1c1c',
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
    shadowColor: 'rgba(26, 28, 28, 0.04)',
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
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
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
