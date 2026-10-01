import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient from '../utils/api';
import { getAuthToken } from '../utils/authSession';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { fonts, radii, space } from '../utils/designTokens';
import { getListingDisplayName } from '../utils/listingDisplayName';
import { countdownFromEndsAt } from '../utils/auctionCountdown';
import { fillTemplate } from '../utils/listingBidUi';
import { openPhoneDialer } from '../utils/phoneDialer';
import {
  bidderInitial,
  formatReceivedBidTimestamp,
  highestReceivedBidId,
  receivedAuctionHeader,
  receivedBidRecords,
} from '../utils/receivedBidsUi';
import { Button, EmptyState } from '../components/ui';

function formatJod(value) {
  if (value == null || String(value).trim() === '') return null;
  return `${value} JOD`;
}

export default function ReceivedListingBidsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const listingId = route.params?.listingId;
  const { colors } = useTheme();
  const { t, isRTL, language } = useLanguage();
  const [bids, setBids] = useState([]);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredRefetchFor = useRef(null);

  const title = getListingDisplayName(route.params?.brandName, route.params?.modelName);
  const header = receivedAuctionHeader(auction);
  const live = header.showCountdown;
  const countdown = live ? countdownFromEndsAt(auction.ends_at, nowMs) : null;
  const highestId = highestReceivedBidId(bids, auction?.current_highest_bid);
  const highestAmount = formatJod(auction?.current_highest_bid);

  const fetchBids = useCallback(async () => {
    if (!listingId) {
      setBids([]);
      setAuction(null);
      setLoadError(t('bids.loadFailed'));
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const token = await getAuthToken();
    if (!token) {
      setBids([]);
      setAuction(null);
      setLoadError(t('bids.loadFailed'));
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoadError(null);
      const response = await apiClient.get(`/listings/${listingId}/bids`);
      setAuction(response.data?.auction && typeof response.data.auction === 'object'
        ? response.data.auction
        : null);
      setBids(receivedBidRecords(response.data?.bids));
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('ReceivedListingBidsScreen.fetch', error);
      setBids([]);
      setAuction(null);
      setLoadError(getApiErrorMessage(error, t('bids.loadFailed')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, listingId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBids();
    }, [fetchBids])
  );

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  useEffect(() => {
    if (!live || !countdown?.valid || !countdown.expired) return;
    const key = `${listingId}:${auction.ends_at}`;
    if (expiredRefetchFor.current === key) return;
    expiredRefetchFor.current = key;
    fetchBids();
  }, [auction?.ends_at, countdown?.expired, countdown?.valid, fetchBids, listingId, live]);

  const callBidder = (phoneNumber) => {
    openPhoneDialer(phoneNumber, {
      unavailableMessage: t('common.sellerPhoneUnavailable'),
      dialerUnavailableMessage: t('common.phoneDialerUnavailable'),
    });
  };

  const renderBid = ({ item }) => {
    const initial = bidderInitial(item.bidder?.name);
    const isHighest = item.id != null && item.id === highestId;
    return (
      <View
        style={[
          styles.bidRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.onPrimary }]}>
            {initial || '•'}
          </Text>
        </View>
        <View
          style={[
            styles.bidCopy,
            {
              marginLeft: isRTL ? 0 : space[3],
              marginRight: isRTL ? space[3] : 0,
            },
          ]}
        >
          <View style={[styles.bidTop, getFlexDirection(isRTL, 'row')]}>
            <Text
              style={[styles.bidderName, { color: colors.text }, getTextAlign(isRTL, 'auto')]}
              numberOfLines={1}
            >
              {item.bidder?.name || t('sellerBid.bidder')}
            </Text>
            <Text style={[styles.bidAmount, { color: colors.primary }]}>
              {formatJod(item.amount)}
            </Text>
          </View>
          <Text
            style={[styles.bidTime, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
          >
            {formatReceivedBidTimestamp(item.created_at, t, nowMs, language)}
          </Text>
          {isHighest ? (
            <Text style={[styles.highestLabel, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>
              {t('bids.highestBid')}
            </Text>
          ) : null}
        </View>
        <Button
          label={t('sellerBid.call')}
          variant="outline"
          fullWidth={false}
          onPress={() => callBidder(item.bidder?.phone_number)}
          style={[
            styles.callButton,
            {
              marginLeft: isRTL ? 0 : space[2],
              marginRight: isRTL ? space[2] : 0,
            },
          ]}
        />
      </View>
    );
  };

  const summary = auction ? (
    <View
      style={[
        styles.summary,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.summaryRow, getFlexDirection(isRTL, 'row')]}>
        <View style={styles.summaryCell}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
            {t('bids.currentHighestBid')}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>
            {highestAmount || t('bids.noBidsYet')}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
            {t('bids.totalBids')}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {fillTemplate(t('bids.bidCountWithNumber'), { count: String(bids.length) })}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
            {t(header.labelKey)}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {live && countdown?.valid && !countdown.expired
              ? countdown.clockLabel || countdown.label
              : t(header.valueKey)}
          </Text>
        </View>
      </View>
    </View>
  ) : null;

  const listHeader = (
    <View>
      {title ? (
        <Text style={[styles.listingTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {title}
        </Text>
      ) : null}
      {summary}
      {!loadError && !loading && bids.length > 0 ? (
        <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('bids.receivedBids')}
        </Text>
      ) : null}
    </View>
  );

  const body = loadError ? (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('common.error')}
      description={loadError}
      actionLabel={t('common.retry')}
      onAction={() => {
        setLoading(true);
        fetchBids();
      }}
      style={styles.errorState}
    />
  ) : loading && bids.length === 0 ? (
    <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
  ) : (
    <FlatList
      data={bids}
      keyExtractor={(item, index) => String(item.id ?? index)}
      renderItem={renderBid}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          fetchBids();
        }} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <EmptyState icon="hammer-outline" title={t('bids.noBidsYet')} />
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
            {t('bids.receivedBids')}
          </Text>
        </View>
      </View>
      <View style={styles.body}>{body}</View>
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
  body: { flex: 1 },
  loader: {
    marginTop: space[8],
  },
  errorState: { flex: 1 },
  listContent: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
    flexGrow: 1,
  },
  listingTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    lineHeight: 26,
    marginBottom: space[4],
  },
  summary: {
    borderRadius: radii['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: space[4],
    marginBottom: space[5],
  },
  summaryRow: {
    alignItems: 'flex-start',
    gap: space[3],
  },
  summaryCell: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.labelBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    marginBottom: space[1],
  },
  summaryValue: {
    fontFamily: fonts.headline,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: fonts.headline,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: space[3],
  },
  bidRow: {
    alignItems: 'center',
    borderRadius: radii['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: space[3],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
  },
  bidCopy: {
    flex: 1,
    minWidth: 0,
  },
  bidTop: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  bidderName: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 15,
    lineHeight: 20,
  },
  bidAmount: {
    fontFamily: fonts.labelBold,
    fontSize: 15,
    lineHeight: 20,
  },
  bidTime: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  highestLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
    lineHeight: 16,
    marginTop: space[1],
  },
  callButton: {
    paddingHorizontal: space[3],
    minHeight: 36,
  },
});
