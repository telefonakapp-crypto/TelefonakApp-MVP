import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { getAuthToken } from '../utils/authSession';
import { logApiError } from '../utils/apiError';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import { getListingDisplayName } from '../utils/listingDisplayName';
import { countdownFromEndsAt } from '../utils/auctionCountdown';
import { fillTemplate } from '../utils/listingBidUi';
import {
  bidRowStatusKey,
  buildBidsQuery,
  isCurrentlyHighest,
  isLiveBidRow,
  isWinningBid,
  parseBidsPage,
} from '../utils/bidListUi';
import {
  Card,
  Chip,
  EmptyState,
  HorizontalCardSkeleton,
  StatusBadge,
} from '../components/ui';

function formatJod(value) {
  if (value == null || String(value).trim() === '') return null;
  return `${value} JOD`;
}

function badgeStatusForRow(statusKey) {
  if (statusKey === 'live') return 'approved';
  if (statusKey === 'cancelled') return 'declined';
  if (statusKey === 'sold' || statusKey === 'bidDurationEnded' || statusKey === 'completed') {
    return 'sold';
  }
  if (statusKey === 'hidden') return 'hidden';
  if (statusKey === 'pending') return 'pending';
  return statusKey;
}

export default function BidsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [segment, setSegment] = useState('my');
  const [myListings, setMyListings] = useState([]);
  const [receivedListings, setReceivedListings] = useState([]);
  const [myHasMore, setMyHasMore] = useState(false);
  const [receivedHasMore, setReceivedHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inFlight = useRef({ my: false, received: false });
  const expiredRefetchFor = useRef({});

  const listings = segment === 'my' ? myListings : receivedListings;
  const hasMore = segment === 'my' ? myHasMore : receivedHasMore;

  const setTabListings = (tab, next, more) => {
    if (tab === 'my') {
      setMyListings(next);
      setMyHasMore(more);
    } else {
      setReceivedListings(next);
      setReceivedHasMore(more);
    }
  };

  const fetchTab = useCallback(async (tab, { offset = 0, append = false } = {}) => {
    const token = await getAuthToken();
    if (!token) {
      setTabListings(tab, [], false);
      setLoadError(false);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }
    if (inFlight.current[tab] && append) {
      setLoadingMore(false);
      return;
    }
    if (inFlight.current[tab]) return;
    inFlight.current[tab] = true;
    try {
      setLoadError(false);
      const response = await apiClient.get(
        tab === 'my' ? '/bids/my' : '/bids/received',
        buildBidsQuery(offset)
      );
      const page = parseBidsPage(response.data);
      if (tab === 'my') {
        setMyListings((prev) => {
          if (!append) return page.listings;
          const seen = new Set(prev.map((row) => row.id));
          return [...prev, ...page.listings.filter((row) => !seen.has(row.id))];
        });
        setMyHasMore(page.hasMore);
      } else {
        setReceivedListings((prev) => {
          if (!append) return page.listings;
          const seen = new Set(prev.map((row) => row.id));
          return [...prev, ...page.listings.filter((row) => !seen.has(row.id))];
        });
        setReceivedHasMore(page.hasMore);
      }
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('BidsScreen.fetch', error);
      setLoadError(true);
      if (!append) {
        setTabListings(tab, [], false);
      }
    } finally {
      inFlight.current[tab] = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTab(segment, { offset: 0, append: false });
    }, [fetchTab, segment])
  );

  const liveRows = listings.filter((row) => isLiveBidRow(row) && row.auction?.ends_at);

  useEffect(() => {
    if (liveRows.length === 0) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveRows.length, segment]);

  useEffect(() => {
    const expired = liveRows.find((row) => {
      const countdown = countdownFromEndsAt(row.auction?.ends_at, nowMs);
      return countdown.valid && countdown.expired;
    });
    if (!expired) return;
    const key = `${segment}:${expired.id}:${expired.auction.ends_at}`;
    if (expiredRefetchFor.current[key]) return;
    expiredRefetchFor.current[key] = true;
    fetchTab(segment, { offset: 0, append: false });
  }, [fetchTab, liveRows, nowMs, segment]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTab(segment, { offset: 0, append: false });
  };

  const onEndReached = () => {
    if (loading || loadingMore || refreshing || !hasMore || inFlight.current[segment]) {
      return;
    }
    setLoadingMore(true);
    fetchTab(segment, { offset: listings.length, append: true });
  };

  const switchSegment = (next) => {
    if (next === segment) return;
    setSegment(next);
    setLoadError(false);
    setLoading(true);
  };

  const statusLabel = (statusKey) => {
    switch (statusKey) {
      case 'live':
        return t('bids.live');
      case 'pending':
        return t('common.pending');
      case 'cancelled':
        return t('bids.cancelled');
      case 'sold':
        return t('myListings.sold');
      case 'bidDurationEnded':
        return t('myListings.bidDurationEnded');
      case 'hidden':
        return t('myListings.hidden');
      default:
        return t('bids.completed');
    }
  };

  const openListing = (listingId) => {
    if (!listingId) return;
    navigation.navigate('ListingDetails', { listingId });
  };

  const openReceivedListing = (item) => {
    if (!item?.id) return;
    navigation.navigate('ReceivedListingBids', {
      listingId: item.id,
      brandName: item.brand_name,
      modelName: item.model_name,
    });
  };

  const renderReceivedItem = ({ item }) => {
    const auction = item.auction && typeof item.auction === 'object' ? item.auction : {};
    const statusKey = bidRowStatusKey(item);
    const live = isLiveBidRow(item);
    const countdown = live ? countdownFromEndsAt(auction.ends_at, nowMs) : null;
    const currentBid = formatJod(auction.current_highest_bid);
    const bidCount = Number(auction.bid_count);

    return (
      <Card style={styles.card} padded={false} elevated>
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => openReceivedListing(item)}
          accessibilityRole="button"
          activeOpacity={0.86}
        >
          <View style={[styles.identityRow, getFlexDirection(isRTL, 'row')]}>
            {item.thumbnail_image ? (
              <Image
                source={{ uri: resolveMediaUrl(item.thumbnail_image) }}
                style={styles.thumbnail}
              />
            ) : (
              <View
                style={[
                  styles.thumbnail,
                  styles.thumbnailPlaceholder,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              </View>
            )}
            <View
              style={[
                styles.info,
                {
                  marginLeft: isRTL ? 0 : space[3],
                  marginRight: isRTL ? space[3] : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.listingTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
                numberOfLines={2}
              >
                {getListingDisplayName(item.brand_name, item.model_name)}
              </Text>
              <View style={[styles.badgeRow, getFlexDirection(isRTL, 'row')]}>
                <StatusBadge
                  status={badgeStatusForRow(statusKey)}
                  label={statusLabel(statusKey)}
                />
              </View>
              {currentBid ? (
                <Text
                  style={[styles.meta, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}
                >
                  {t('bids.highestShort')}: {currentBid}
                </Text>
              ) : (
                <Text
                  style={[styles.meta, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                >
                  {t('bids.noBidsYet')}
                </Text>
              )}
              {Number.isFinite(bidCount) ? (
                <Text
                  style={[styles.meta, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                >
                  {fillTemplate(t('bids.bidCountWithNumber'), { count: String(bidCount) })}
                </Text>
              ) : null}
              {live && countdown?.valid && (countdown.clockLabel || countdown.label) ? (
                <Text
                  style={[styles.meta, { color: colors.text }, getTextAlign(isRTL, 'auto')]}
                >
                  {countdown.clockLabel || countdown.label}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderItem = ({ item }) => {
    if (segment === 'received') return renderReceivedItem({ item });
    const auction = item.auction && typeof item.auction === 'object' ? item.auction : {};
    const statusKey = bidRowStatusKey(item);
    const live = isLiveBidRow(item);
    const countdown = live ? countdownFromEndsAt(auction.ends_at, nowMs) : null;
    const highestMine = isCurrentlyHighest(auction);
    const won = isWinningBid(auction);
    const yourBid = formatJod(auction.my_highest_bid);
    const currentBid = formatJod(auction.current_highest_bid);

    return (
      <Card style={styles.card} padded={false} elevated>
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => openListing(item.id)}
          accessibilityRole="button"
          activeOpacity={0.86}
        >
          <View style={[styles.identityRow, getFlexDirection(isRTL, 'row')]}>
            {item.thumbnail_image ? (
              <Image
                source={{ uri: resolveMediaUrl(item.thumbnail_image) }}
                style={styles.thumbnail}
              />
            ) : (
              <View
                style={[
                  styles.thumbnail,
                  styles.thumbnailPlaceholder,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              </View>
            )}
            <View
              style={[
                styles.info,
                {
                  marginLeft: isRTL ? 0 : space[3],
                  marginRight: isRTL ? space[3] : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.listingTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
                numberOfLines={2}
              >
                {getListingDisplayName(item.brand_name, item.model_name)}
              </Text>
              <View style={[styles.badgeRow, getFlexDirection(isRTL, 'row')]}>
                <StatusBadge
                  status={badgeStatusForRow(statusKey)}
                  label={statusLabel(statusKey)}
                />
                {highestMine ? <Chip label={t('bids.highest')} /> : null}
                {won ? <Chip label={t('bids.winningBid')} /> : null}
              </View>
              {yourBid ? (
                <Text style={[styles.meta, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>
                  {t('bids.yourBid')}: {yourBid}
                </Text>
              ) : null}
              {currentBid ? (
                <Text
                  style={[styles.meta, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                >
                  {t('bids.currentHighestBid')}: {currentBid}
                </Text>
              ) : (
                <Text
                  style={[styles.meta, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                >
                  {t('bids.noBidsYet')}
                </Text>
              )}
              {live && countdown?.valid && countdown.label ? (
                <Text
                  style={[styles.meta, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                >
                  {t('bids.timeRemaining')}: {countdown.label}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  const listBody =
    loadError && listings.length === 0 ? (
      <EmptyState
        icon="cloud-offline-outline"
        title={t('common.error')}
        description={t('bids.loadFailed')}
        actionLabel={t('common.retry')}
        onAction={() => {
          setLoading(true);
          fetchTab(segment, { offset: 0, append: false });
        }}
        style={styles.errorState}
      />
    ) : loading && listings.length === 0 ? (
      <View style={styles.skeletonList}>
        {Array.from({ length: 3 }).map((_, index) => (
          <HorizontalCardSkeleton key={index} />
        ))}
      </View>
    ) : (
      <FlatList
        data={listings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          segment === 'received' && listings.length > 0 ? (
            <Text
              style={[
                styles.receivedCount,
                { color: colors.textSecondary },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {fillTemplate(t('bids.listingsWithReceivedBids'), {
                count: String(listings.length),
              })}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="hammer-outline"
            title={segment === 'my' ? t('bids.noBidsYet') : t('bids.noBidsReceived')}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={styles.footerSpinner}
              size="small"
              color={colors.primary}
            />
          ) : null
        }
      />
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={[styles.titleRow, getFlexDirection(isRTL, 'row')]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerLeft}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('home.bidsNav')}
          </Text>
        </View>
        <View
          style={[
            styles.segmentTrack,
            { backgroundColor: colors.surfaceContainerLow },
            getFlexDirection(isRTL, 'row'),
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segment,
              segment === 'my' && { backgroundColor: colors.surface },
              segment === 'my' && styles.segmentActiveShadow,
            ]}
            onPress={() => switchSegment('my')}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === 'my' }}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: segment === 'my' ? colors.primary : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {t('bids.myBids')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              segment === 'received' && { backgroundColor: colors.surface },
              segment === 'received' && styles.segmentActiveShadow,
            ]}
            onPress={() => switchSegment('received')}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === 'received' }}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: segment === 'received' ? colors.primary : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {receivedListings.length > 0
                ? fillTemplate(t('bids.receivedBidsCount'), {
                    count: String(receivedListings.length),
                  })
                : t('bids.receivedBids')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.body}>{listBody}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[4],
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: space[4],
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  segmentTrack: {
    borderRadius: radii['2xl'],
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveShadow: {
    ...ambientElevation,
  },
  segmentLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
  },
  body: { flex: 1 },
  skeletonList: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    gap: space[3],
  },
  errorState: { flex: 1 },
  listContent: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[8],
    flexGrow: 1,
  },
  card: {
    borderRadius: radii['2xl'] + 4,
  },
  cardTop: {
    padding: space[4],
  },
  identityRow: {
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 96,
    height: 96,
    borderRadius: radii['2xl'],
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  listingTitle: {
    fontFamily: fonts.headline,
    fontSize: 16,
    lineHeight: 22,
  },
  receivedCount: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: space[3],
  },
  badgeRow: {
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[1],
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  footerSpinner: {
    marginVertical: space[4],
  },
});
