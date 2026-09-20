import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useOffersUnread } from '../context/OffersUnreadContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import OfferStatusBadge from '../components/OfferStatusBadge';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { fonts, radii, space } from '../utils/designTokens';
import { getListingDisplayName } from '../utils/listingDisplayName';
import { filterReceivedOffersByListingId } from '../utils/receivedOffersListingFilter';
import {
  Button,
  Card,
  EmptyState,
  HorizontalCardSkeleton,
  IconButton,
} from '../components/ui';

function formatOfferDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isUnreadReceivedOffer(offer) {
  return offer?.status === 'pending' && !offer?.seller_seen_at;
}

export default function ReceivedOffersScreen({ embedded = false }) {
  const navigation = useNavigation();
  const route = useRoute();
  const listingIdFilter = route.params?.listingId;
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const {
    refreshUnreadOffersCount,
    decrementUnreadOffersCount,
  } = useOffersUnread();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const markingSeenIds = useRef(new Set());
  const markOfferSeenRef = useRef(null);

  const fetchOffers = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await apiClient.get('/offers/received');
      setOffers(response.data.offers || []);
      refreshUnreadOffersCount();
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      console.error('Error fetching received offers:', error.response?.data || error.message);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnreadOffersCount]);

  useFocusEffect(
    useCallback(() => {
      fetchOffers();
    }, [fetchOffers])
  );

  const markOfferSeen = useCallback(
    async (offer) => {
      if (!isUnreadReceivedOffer(offer)) return;
      if (markingSeenIds.current.has(offer.id)) return;

      markingSeenIds.current.add(offer.id);
      // Optimistic: clear local unread styling and drop badge by 1.
      setOffers((prev) =>
        prev.map((item) =>
          item.id === offer.id
            ? { ...item, seller_seen_at: item.seller_seen_at || new Date().toISOString() }
            : item
        )
      );
      decrementUnreadOffersCount(1);

      try {
        await apiClient.patch(`/offers/${offer.id}/seen`);
      } catch (error) {
        markingSeenIds.current.delete(offer.id);
        logApiError('ReceivedOffersScreen.markSeen', error);
        refreshUnreadOffersCount();
        fetchOffers();
      }
    },
    [decrementUnreadOffersCount, fetchOffers, refreshUnreadOffersCount]
  );

  markOfferSeenRef.current = markOfferSeen;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems.forEach((entry) => {
      if (entry?.isViewable && entry.item) {
        markOfferSeenRef.current?.(entry.item);
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 400,
  }).current;

  const onRefresh = () => {
    setRefreshing(true);
    fetchOffers();
  };

  const retryOffers = () => {
    setLoading(true);
    fetchOffers();
  };

  // The response carries the updated row, so there is no need to refetch the list.
  const resolveOffer = async (offer, action) => {
    setResolvingId(offer.id);
    try {
      const wasUnread = isUnreadReceivedOffer(offer);
      const response = await apiClient.patch(`/offers/${offer.id}/${action}`);
      const updated = response.data.offer;
      setOffers((prev) => prev.map((item) => (item.id === offer.id ? { ...item, ...updated } : item)));
      if (wasUnread) {
        decrementUnreadOffersCount(1);
      } else {
        refreshUnreadOffersCount();
      }
    } catch (error) {
      logApiError(`ReceivedOffersScreen.${action}`, error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('offers.actionFailed'))
      );
      fetchOffers();
    } finally {
      setResolvingId(null);
    }
  };

  const confirmResolve = (offer, action) => {
    Alert.alert(
      action === 'accept' ? t('offers.acceptOffer') : t('offers.rejectOffer'),
      action === 'accept' ? t('offers.acceptConfirm') : t('offers.rejectConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: action === 'accept' ? t('offers.accept') : t('offers.reject'),
          style: action === 'accept' ? 'default' : 'destructive',
          onPress: () => resolveOffer(offer, action),
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const busy = resolvingId === item.id;
    const unread = isUnreadReceivedOffer(item);

    return (
      <Card
        style={[
          styles.card,
          unread && {
            borderWidth: 1,
            borderColor: colors.primary,
          },
        ]}
        padded={false}
        elevated
      >
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => {
            markOfferSeen(item);
            navigation.navigate('ListingDetails', { listingId: item.listing_id });
          }}
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
              <View style={[styles.titleRow, getFlexDirection(isRTL, 'row')]}>
                <Text
                  style={[
                    styles.listingTitle,
                    { color: colors.text, flex: 1 },
                    getTextAlign(isRTL, 'auto'),
                  ]}
                  numberOfLines={2}
                >
                  {getListingDisplayName(item.brand_name, item.model_name)}
                </Text>
                {unread ? (
                  <View style={[styles.unreadDot, { backgroundColor: colors.error }]} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.buyerName,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
                numberOfLines={1}
              >
                {t('offers.offerFrom') || 'Offer from'} {item.buyer_first_name}{' '}
                {item.buyer_last_name}
              </Text>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                {t('offers.offerAmount') || 'Offer amount'}
              </Text>
              <Text
                style={[
                  styles.offerPrice,
                  { color: colors.primary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {item.offered_price} JOD
              </Text>
              <Text
                style={[
                  styles.askingPrice,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('offers.askingPriceIs')} {item.listing_price} JOD
              </Text>
            </View>
          </View>

          <View style={[styles.metaRow, getFlexDirection(isRTL, 'row')]}>
            <OfferStatusBadge status={item.status} />
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {formatOfferDate(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        {item.status === 'pending' && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={[styles.actions, getFlexDirection(isRTL, 'row')]}>
              <Button
                label={t('offers.accept')}
                onPress={() => confirmResolve(item, 'accept')}
                disabled={busy}
                loading={busy}
                style={styles.actionButton}
              />
              <Button
                label={t('offers.reject')}
                variant="outline"
                onPress={() => confirmResolve(item, 'reject')}
                disabled={busy}
                style={styles.actionButton}
                textStyle={{ color: colors.error }}
              />
            </View>
          </>
        )}
      </Card>
    );
  };

  const listBody = loading ? (
    <View style={styles.skeletonList}>
      {Array.from({ length: 3 }).map((_, index) => (
        <HorizontalCardSkeleton key={index} action={index < 2} />
      ))}
    </View>
  ) : loadError && offers.length === 0 ? (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('common.error')}
      description={t('common.somethingWentWrong')}
      actionLabel={t('common.retry')}
      onAction={retryOffers}
      style={styles.errorState}
    />
  ) : (
    <FlatList
      data={filterReceivedOffersByListingId(offers, listingIdFilter)}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="pricetags-outline"
          title={t('offers.noReceivedOffers')}
          description={t('offers.noReceivedOffersDesc')}
        />
      }
    />
  );

  if (embedded) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}>{listBody}</View>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
        <IconButton
          name={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={() => navigation.goBack()}
        />
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('offers.receivedOffers')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {listBody}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 18,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  skeletonList: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    gap: space[3],
  },
  errorState: {
    flex: 1,
  },
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
  titleRow: {
    alignItems: 'flex-start',
    gap: space[2],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
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
  },
  listingTitle: {
    fontFamily: fonts.headline,
    fontSize: 16,
    lineHeight: 21,
  },
  buyerName: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  amountLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    marginTop: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  offerPrice: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 28,
  },
  askingPrice: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  date: {
    fontFamily: fonts.label,
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: space[4],
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
  },
});
