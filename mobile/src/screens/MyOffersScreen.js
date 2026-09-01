import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { openPhoneDialer } from '../utils/phoneDialer';
import OfferStatusBadge from '../components/OfferStatusBadge';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { fonts, radii, space } from '../utils/designTokens';
import { getListingDisplayName } from '../utils/listingDisplayName';
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

export default function MyOffersScreen({ embedded = false }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await apiClient.get('/offers/sent');
      setOffers(response.data.offers || []);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      console.error('Error fetching sent offers:', error.response?.data || error.message);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOffers();
    }, [fetchOffers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOffers();
  };

  const retryOffers = () => {
    setLoading(true);
    fetchOffers();
  };

  const renderItem = ({ item }) => (
    <Card style={styles.card} padded={false} elevated>
      {/* A sold or hidden listing is no longer readable by the buyer, so the
          offer stays as history but the row does not lead to a dead end. */}
      <TouchableOpacity
        style={styles.cardTop}
        onPress={() => navigation.navigate('ListingDetails', { listingId: item.listing_id })}
        disabled={item.listing_status !== 'approved'}
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
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
              {t('offers.yourOffer')}
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

      {/* The API only returns the seller's number for accepted offers */}
      {item.status === 'accepted' && !!item.seller_phone_number && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.actions}>
          <Button
            label={t('offers.callSeller')}
            onPress={() =>
              openPhoneDialer(item.seller_phone_number, {
                unavailableMessage: t('common.sellerPhoneUnavailable'),
                dialerUnavailableMessage: t('common.phoneDialerUnavailable'),
              })
            }
            style={styles.callButton}
          />
          </View>
        </>
      )}
    </Card>
  );

  const listBody = loading ? (
    <View style={styles.skeletonList}>
      {Array.from({ length: 3 }).map((_, index) => (
        <HorizontalCardSkeleton key={index} action={index === 0} />
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
      data={offers}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="pricetag-outline"
          title={t('offers.noSentOffers')}
          description={t('offers.noSentOffersDesc')}
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
          {t('offers.myOffers')}
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
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  callButton: {
    minHeight: 46,
  },
});
