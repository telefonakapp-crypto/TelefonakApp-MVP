import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  AppState,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { useFavorites } from '../context/FavoritesContext';
import { openPhoneDialer } from '../utils/phoneDialer';
import FavoriteButton from '../components/FavoriteButton';
import { getListingDisplayName } from '../utils/listingDisplayName';
import {
  markListingSold,
  setListingVisibility as requestListingVisibility,
  deleteListing,
  shareListing,
} from '../utils/listingOwnerActions';
import {
  isBidListing,
  isLiveBidListing,
  listingOwnerCapabilities,
} from '../utils/listingOwnerCapabilities';
import { countdownFromEndsAt } from '../utils/auctionCountdown';
import {
  auctionDurationLabelKey,
  auctionDurationOptions,
  DEFAULT_AUCTION_DURATION_HOURS,
  isAllowedAuctionDuration,
} from '../utils/auctionDuration';
import {
  applyExtendToListing,
  applyPlaceBidToListing,
  auctionHasBids,
  bidAmountIssue,
  buildCancelEndBidBody,
  buildExtendBidBody,
  buildListAgainBody,
  buildSoldEndBidBody,
  canExtendLiveBid,
  canListAgain,
  canManageLiveBid,
  canPlaceBidOnListing,
  fillTemplate,
  isViewerHighestBidder,
  isViewerOutbid,
  formatBidTimeAgo,
  sanitizePublicBidHistory,
  shouldFetchPublicBidHistory,
  shouldShowMakeOffer,
  shouldShowOfferCard,
} from '../utils/listingBidUi';
import { getAuthToken } from '../utils/authSession';
import {
  bidErrorI18nKey,
  bidErrorNeedsRefresh,
  bidErrorShouldCloseListAgain,
  bidErrorShouldCloseSellerUi,
  bidErrorShouldCloseSheet,
  isInvalidWinningBidError,
} from '../utils/bidApiErrors';
import OfferStatusBadge from '../components/OfferStatusBadge';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { showToast } from '../utils/toast';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import {
  Button,
  BottomSheet,
  Card,
  DetailScreenSkeleton,
  IconButton,
  EmptyState,
  OwnerActionRow,
  ownerActionListStyle,
  StatusBadge,
  TextField,
} from '../components/ui';
import { isSmartwatchListing } from '../utils/listingCatalogForm';
import { formatListingLocation } from '../utils/marketplaceFilters';
import { conditionKey, localizeConditionName } from '../utils/listingCondition';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GALLERY_HEIGHT = Math.min(SCREEN_WIDTH * 0.95, 400);
const GALLERY_FALLBACK = require('../../assets/telefonak-splash-phone-t.png');

/** Day label + clock for an auction ends_at. Does not drive the countdown. */
function formatAuctionEndParts(endsAt, t, language, nowMs = Date.now()) {
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const isPm = hours >= 12;
  hours = hours % 12 || 12;
  const suffix = language === 'ar' ? (isPm ? 'م' : 'ص') : isPm ? 'PM' : 'AM';
  const time = `${hours}:${minutes} ${suffix}`;
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = startOfToday.getTime() + 86400000;
  const startOfDayAfter = startOfTomorrow + 86400000;
  const endMs = date.getTime();
  let dayLabel;
  if (endMs >= startOfToday.getTime() && endMs < startOfTomorrow) {
    dayLabel = t('bids.endsToday');
  } else if (endMs >= startOfTomorrow && endMs < startOfDayAfter) {
    dayLabel = t('bids.endsTomorrow');
  } else {
    const day = date.toLocaleDateString(language === 'ar' ? 'ar' : 'en', {
      day: 'numeric',
      month: 'short',
    });
    dayLabel = fillTemplate(t('bids.endsOn'), { day });
  }
  return { dayLabel, time };
}

function sellerInitials(listing) {
  const first = String(listing?.first_name || '').trim();
  const last = String(listing?.last_name || '').trim();
  const letters = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return letters || '?';
}

/** Soft tinted pills — condition-specific, Telefonak-aligned. */
function getConditionTone(conditionName, isDarkMode = false) {
  const key = conditionKey(conditionName);
  if (key === 'new') {
    return isDarkMode
      ? { backgroundColor: 'rgba(74, 222, 128, 0.16)', color: '#86efac' }
      : { backgroundColor: 'rgba(38, 105, 49, 0.14)', color: '#1b5e20' };
  }
  if (key === 'likenew' || key === 'usedlikenew') {
    return isDarkMode
      ? { backgroundColor: 'rgba(96, 165, 250, 0.18)', color: '#93c5fd' }
      : { backgroundColor: 'rgba(25, 118, 210, 0.14)', color: '#1976D2' };
  }
  if (
    key === 'excellent' ||
    key === 'verygood' ||
    key === 'good' ||
    key === 'usedgood' ||
    key === 'used'
  ) {
    return isDarkMode
      ? { backgroundColor: 'rgba(251, 191, 36, 0.18)', color: '#fcd34d' }
      : { backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#9a3412' };
  }
  if (key === 'fair' || key === 'usedfair' || key === 'poor') {
    return isDarkMode
      ? { backgroundColor: 'rgba(248, 113, 113, 0.18)', color: '#fca5a5' }
      : { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c' };
  }
  return isDarkMode
    ? { backgroundColor: 'rgba(96, 165, 250, 0.18)', color: '#93c5fd' }
    : { backgroundColor: 'rgba(25, 118, 210, 0.12)', color: '#1976D2' };
}

function ConditionPill({ conditionName, label }) {
  const { isDarkMode } = useTheme();
  if (!label) return null;
  const tone = getConditionTone(conditionName, isDarkMode);
  return (
    <View style={[styles.conditionPill, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.conditionPillText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

function SpecTile({ label, value, colorDot, colors }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View
      style={[
        styles.specTile,
        { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      <Text style={[styles.specTileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.specTileValueRow}>
        {colorDot ? (
          <View
            style={[
              styles.colorDot,
              { backgroundColor: colorDot, borderColor: colors.border },
            ]}
          />
        ) : null}
        <Text style={[styles.specTileValue, { color: colors.text }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function hasSpecValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function buildListingSpecItems(listing, { t, conditionLabel }) {
  const batteryValue =
    listing.battery_percentage != null && listing.battery_percentage !== ''
      ? `${listing.battery_percentage}%`
      : null;

  if (isSmartwatchListing(listing)) {
    const storageValue = hasSpecValue(listing.storage_display)
      ? listing.storage_display
      : hasSpecValue(listing.capacity_gb)
        ? `${listing.capacity_gb} GB`
        : null;
    const colorValue = listing.color_display_name || listing.color_name || null;

    return [
      {
        key: 'brand',
        label: t('listingDetails.brand') || 'Brand',
        value: listing.brand_name,
      },
      {
        key: 'model',
        label: t('listingDetails.model') || 'Model',
        value: listing.model_name,
      },
      {
        key: 'caseSize',
        label: t('listingDetails.caseSize') || 'Case Size',
        value: listing.case_size_label,
      },
      {
        key: 'connectivity',
        label: t('listingDetails.connectivity') || 'Connectivity',
        value: listing.watch_connectivity_name,
      },
      {
        key: 'storage',
        label: t('listingDetails.storage'),
        value: storageValue,
      },
      {
        key: 'color',
        label: t('listingDetails.colorFinish') || t('listingDetails.color'),
        value: colorValue,
        colorDot: listing.color_hex || null,
      },
      {
        key: 'condition',
        label: t('listingDetails.condition'),
        value: conditionLabel,
      },
      {
        key: 'battery',
        label: t('listingDetails.battery'),
        value: batteryValue,
      },
    ].filter((item) => hasSpecValue(item.value));
  }

  return [
    {
      key: 'brand',
      label: t('listingDetails.brand') || 'Brand',
      value: listing.brand_name,
    },
    {
      key: 'model',
      label: t('listingDetails.model') || 'Model',
      value: listing.model_name,
    },
    {
      key: 'storage',
      label: t('listingDetails.storage'),
      value: listing.storage_display || (listing.capacity_gb ? `${listing.capacity_gb} GB` : null),
    },
    {
      key: 'battery',
      label: t('listingDetails.battery'),
      value: batteryValue,
    },
    {
      key: 'color',
      label: t('listingDetails.color'),
      value: listing.color_display_name || listing.color_name,
      colorDot: listing.color_hex || null,
    },
    {
      key: 'sim',
      label: t('listingDetails.simConfiguration'),
      value: listing.sim_configuration_name,
    },
    {
      key: 'screen',
      label: t('listingDetails.screenSize') || 'Screen',
      value: listing.screen_size ? `${listing.screen_size}"` : null,
    },
    {
      key: 'condition',
      label: t('listingDetails.condition'),
      value: conditionLabel,
    },
  ].filter((item) => item.value);
}

export default function ListingDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { listingId } = route.params;
  const { loadFavorites } = useFavorites();
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [ownerActionBusy, setOwnerActionBusy] = useState(false);
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidAmountError, setBidAmountError] = useState(null);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [myBids, setMyBids] = useState([]);
  const [myBidsLoading, setMyBidsLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sellerSheet, setSellerSheet] = useState(null);
  const [endStep, setEndStep] = useState('choose');
  const [selectedWinningBidId, setSelectedWinningBidId] = useState(null);
  const [sellerBids, setSellerBids] = useState([]);
  const [sellerBidsLoading, setSellerBidsLoading] = useState(false);
  const [extendHours, setExtendHours] = useState(null);
  const [endBidSubmitting, setEndBidSubmitting] = useState(false);
  const [extendBidSubmitting, setExtendBidSubmitting] = useState(false);
  const [listAgainSubmitting, setListAgainSubmitting] = useState(false);
  const [listAgainHours, setListAgainHours] = useState(DEFAULT_AUCTION_DURATION_HOURS);
  const [publicBids, setPublicBids] = useState([]);
  const [publicBidsHasMore, setPublicBidsHasMore] = useState(false);
  const [publicBidsLoading, setPublicBidsLoading] = useState(false);
  const [publicBidsError, setPublicBidsError] = useState(false);
  const horizontalScrollViewRef = useRef(null);
  const registeredViewFor = useRef(null);
  const expiredRefetchFor = useRef(null);

  const fetchPublicBidHistory = useCallback(async (listing) => {
    if (!listingId || !shouldFetchPublicBidHistory(listing)) {
      setPublicBids([]);
      setPublicBidsHasMore(false);
      setPublicBidsError(false);
      setPublicBidsLoading(false);
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setPublicBids([]);
      setPublicBidsHasMore(false);
      setPublicBidsError(false);
      setPublicBidsLoading(false);
      return;
    }

    setPublicBidsLoading(true);
    try {
      const response = await apiClient.get(`/listings/${listingId}/bid-history`, {
        params: { limit: 4 },
      });
      const sanitized = sanitizePublicBidHistory(response.data);
      setPublicBids(sanitized.bids);
      setPublicBidsHasMore(sanitized.has_more);
      setPublicBidsError(false);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('ListingDetailsScreen.bidHistory', error);
      setPublicBids([]);
      setPublicBidsHasMore(false);
      setPublicBidsError(true);
    } finally {
      setPublicBidsLoading(false);
    }
  }, [listingId]);

  const fetchListingDetails = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await apiClient.get(`/listings/${listingId}`);
      const nextListing = response.data.listing;
      setListing(nextListing);
      setImages(response.data.images || []);
      fetchPublicBidHistory(nextListing);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('ListingDetailsScreen.fetchListingDetails', error);
      setLoadError(error?.response?.status !== 404);
      setPublicBids([]);
      setPublicBidsHasMore(false);
      setPublicBidsError(false);
    } finally {
      setLoading(false);
    }
  }, [listingId, fetchPublicBidHistory]);

  const retryListingDetails = () => {
    setLoading(true);
    fetchListingDetails();
  };

  const registerView = useCallback(async () => {
    if (registeredViewFor.current === listingId) return;
    registeredViewFor.current = listingId;

    try {
      const response = await apiClient.post(`/listings/${listingId}/view`);
      if (response.data?.views !== undefined) {
        setListing((prev) => (prev ? { ...prev, views: response.data.views } : prev));
      }
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('ListingDetailsScreen.registerView', error);
    }
  }, [listingId]);

  useFocusEffect(
    useCallback(() => {
      fetchListingDetails();
    }, [fetchListingDetails])
  );

  useEffect(() => {
    registerView();
  }, [registerView]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isBid = isBidListing(listing);
  const auction = isBid ? listing?.auction : null;
  const countdown = countdownFromEndsAt(auction?.ends_at, nowMs);
  const showPlaceBid = canPlaceBidOnListing(listing);
  const showManageLiveBid = canManageLiveBid(listing);
  const showExtendBid = canExtendLiveBid(listing);
  const showListAgain = canListAgain(listing);
  const sellerBusy = endBidSubmitting || extendBidSubmitting || listAgainSubmitting;
  const tickCountdown =
    isBid &&
    auction?.ends_at &&
    countdown.valid &&
    !countdown.expired &&
    (auction.auction_status === 'live' || auction.auction_status === 'pending_start');

  useEffect(() => {
    if (!tickCountdown) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tickCountdown, auction?.ends_at]);

  useEffect(() => {
    if (!isBid || !countdown.valid || !countdown.expired || !auction?.ends_at) return;
    if (expiredRefetchFor.current === auction.ends_at) return;
    expiredRefetchFor.current = auction.ends_at;
    fetchListingDetails();
  }, [isBid, countdown.valid, countdown.expired, auction?.ends_at, fetchListingDetails]);

  useEffect(() => {
    if (!isBid) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNowMs(Date.now());
      fetchListingDetails();
    });
    return () => sub.remove();
  }, [isBid, fetchListingDetails]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return t('common.pending');
      case 'resubmitted':
        return t('common.resubmitted');
      case 'updated':
        return t('common.updated');
      case 'approved':
        return t('myListings.approved');
      case 'declined':
        return t('common.declined');
      case 'sold':
        return t('myListings.sold');
      case 'hidden':
        return t('myListings.hidden');
      case 'deleted':
        return t('myListings.deleted');
      case 'bid_duration_ended':
        return t('myListings.bidDurationEnded');
      default:
        return status || '—';
    }
  };

  const setListingVisibility = async (action) => {
    setOwnerActionBusy(true);
    try {
      const response = await requestListingVisibility(listingId, action);
      setListing((prev) => (prev ? { ...prev, ...response.data.listing, is_owner: true } : prev));
      Alert.alert(
        t('common.success'),
        action === 'hide' ? t('myListings.hiddenSuccess') : t('myListings.unhiddenSuccess')
      );
    } catch (error) {
      logApiError(`ListingDetailsScreen.${action}`, error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('myListings.visibilityFailed'))
      );
      fetchListingDetails();
    } finally {
      setOwnerActionBusy(false);
    }
  };

  const handleHideListing = () => {
    Alert.alert(t('myListings.hideListing'), t('myListings.hideListingConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myListings.hide'),
        onPress: () => setListingVisibility('hide'),
      },
    ]);
  };

  const handleUnhideListing = () => setListingVisibility('unhide');

  const handleMarkAsSold = () => {
    Alert.alert(t('myListings.markAsSold'), t('myListings.markAsSoldConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myListings.markAsSold'),
        onPress: async () => {
          setOwnerActionBusy(true);
          try {
            await markListingSold(listingId);
            Alert.alert(t('common.success'), t('myListings.markedAsSoldSuccess'));
            fetchListingDetails();
          } catch (error) {
            logApiError('ListingDetailsScreen.markAsSold', error);
            Alert.alert(
              t('common.error'),
              getApiErrorMessage(error, 'Failed to mark listing as sold')
            );
          } finally {
            setOwnerActionBusy(false);
          }
        },
      },
    ]);
  };

  const handleDeleteListing = () => {
    Alert.alert(t('myListings.deleteListing'), t('myListings.deleteListingConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setOwnerActionBusy(true);
          try {
            await deleteListing(listingId);
            Alert.alert(t('common.success'), t('myListings.deletedSuccess'), [
              { text: t('common.ok'), onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            logApiError('ListingDetailsScreen.deleteListing', error);
            Alert.alert(
              t('common.error'),
              getApiErrorMessage(error, t('myListings.deleteFailed'))
            );
            setOwnerActionBusy(false);
          }
        },
      },
    ]);
  };

  const handleShareListing = async () => {
    if (!listing) return;
    try {
      await shareListing(listing, t);
    } catch (error) {
      if (error?.message === 'User did not share') return;
      Alert.alert(t('common.error'), t('listingDetails.shareFailed'));
    }
  };

  const applyMyOfferToListing = (offer) => {
    if (!offer) return;
    setListing((prev) =>
      prev
        ? {
            ...prev,
            has_my_offer: true,
            my_offer: offer,
            my_offer_status: offer.status,
            my_offer_amount: offer.offered_price,
            my_offer_created_at: offer.created_at,
          }
        : prev
    );
  };

  const openOfferModal = (prefillAmount = '') => {
    setOfferAmount(
      prefillAmount !== undefined && prefillAmount !== null && prefillAmount !== ''
        ? String(prefillAmount)
        : ''
    );
    setOfferModalVisible(true);
  };

  const closeOfferModal = () => {
    setOfferModalVisible(false);
    setOfferAmount('');
  };

  const submitOffer = async () => {
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('offers.invalidAmount'));
      return;
    }

    setSubmittingOffer(true);
    try {
      const response = await apiClient.post(`/offers/${listingId}`, { offered_price: amount });
      applyMyOfferToListing(response.data.offer);
      closeOfferModal();
      Alert.alert(
        t('common.success'),
        response.data.updated ? t('offers.offerUpdated') : t('offers.offerSubmitted')
      );
    } catch (error) {
      logApiError('ListingDetailsScreen.submitOffer', error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('offers.submitFailed'))
      );
    } finally {
      setSubmittingOffer(false);
    }
  };

  const openBidSheet = () => {
    setBidAmount('');
    setBidAmountError(null);
    setBidSheetOpen(true);
  };

  const closeBidSheet = () => {
    if (submittingBid) return;
    setBidSheetOpen(false);
    setBidAmount('');
    setBidAmountError(null);
  };

  const submitBid = async () => {
    if (submittingBid) return;
    const amount = String(bidAmount ?? '').trim();
    const issue = bidAmountIssue(amount);
    if (issue === 'amountRequired') {
      setBidAmountError(t('bids.amountRequired'));
      return;
    }
    if (issue) {
      setBidAmountError(t('bids.invalidAmount'));
      return;
    }

    setBidAmountError(null);
    setSubmittingBid(true);
    try {
      const response = await apiClient.post(`/listings/${listingId}/bids`, { amount });
      setListing((prev) => applyPlaceBidToListing(prev, response.data));
      setBidSheetOpen(false);
      setBidAmount('');
      Alert.alert(t('common.success'), t('bids.bidPlaced'));
      fetchListingDetails();
    } catch (error) {
      logApiError('ListingDetailsScreen.submitBid', error);
      const key = bidErrorI18nKey(error);
      Alert.alert(
        t('common.error'),
        key ? t(key) : getApiErrorMessage(error, t('bids.placeBidFailed'))
      );
      if (bidErrorShouldCloseSheet(error)) {
        setBidSheetOpen(false);
        setBidAmount('');
      }
      if (bidErrorNeedsRefresh(error)) {
        fetchListingDetails();
      }
    } finally {
      setSubmittingBid(false);
    }
  };

  const openMyBidsHistory = async () => {
    setHistorySheetOpen(true);
    if (!listing || listing.is_owner || !isBidListing(listing)) return;
    setMyBidsLoading(true);
    try {
      const response = await apiClient.get(`/listings/${listingId}/my-bids`);
      setMyBids(Array.isArray(response.data?.bids) ? response.data.bids : []);
    } catch (error) {
      if (error?.response?.status === 404) {
        setMyBids([]);
        return;
      }
      logApiError('ListingDetailsScreen.myBids', error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('bids.placeBidFailed'))
      );
    } finally {
      setMyBidsLoading(false);
    }
  };

  const formatJod = (value) => `${value} JOD`;

  const closeSellerSheets = () => {
    setSellerSheet(null);
    setEndStep('choose');
    setSelectedWinningBidId(null);
    setExtendHours(null);
    setSellerBids([]);
    setListAgainHours(DEFAULT_AUCTION_DURATION_HOURS);
  };

  const handleSellerAuctionGone = (error) => {
    const key = bidErrorI18nKey(error);
    Alert.alert(
      t('common.error'),
      key ? t(key) : getApiErrorMessage(error, t('sellerBid.endFailed'))
    );
    closeSellerSheets();
    fetchListingDetails();
  };

  const fetchSellerBids = async () => {
    setSellerBidsLoading(true);
    try {
      const response = await apiClient.get(`/listings/${listingId}/bids`);
      setSellerBids(Array.isArray(response.data?.bids) ? response.data.bids : []);
      return true;
    } catch (error) {
      logApiError('ListingDetailsScreen.sellerBids', error);
      if (bidErrorShouldCloseSellerUi(error)) {
        handleSellerAuctionGone(error);
        return false;
      }
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('sellerBid.loadBiddersFailed'))
      );
      return false;
    } finally {
      setSellerBidsLoading(false);
    }
  };

  const openReceivedBids = () => {
    navigation.navigate('ReceivedListingBids', {
      listingId,
      brandName: listing?.brand_name,
      modelName: listing?.model_name,
    });
  };

  const openEndBidSheet = () => {
    setEndStep('choose');
    setSelectedWinningBidId(null);
    setSellerSheet('end');
  };

  const openSoldBidPicker = async () => {
    setEndStep('selectBid');
    setSellerSheet('end');
    await fetchSellerBids();
  };

  const confirmSoldBid = (bid) => {
    if (!bid?.id || sellerBusy) return;
    const name = bid.bidder?.name || t('sellerBid.bidder');
    Alert.alert(
      t('sellerBid.confirmSale'),
      fillTemplate(t('sellerBid.sellConfirm'), { name, amount: bid.amount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sellerBid.soldToBidder'),
          onPress: () => submitEndBidSold(bid.id),
        },
      ]
    );
  };

  const confirmCancelBid = () => {
    Alert.alert(t('sellerBid.confirmCancel'), t('sellerBid.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sellerBid.noLongerSell'),
        style: 'destructive',
        onPress: submitEndBidCancel,
      },
    ]);
  };

  const submitEndBidSold = async (winningBidId) => {
    if (endBidSubmitting || extendBidSubmitting || listAgainSubmitting) return;
    if (winningBidId == null) {
      Alert.alert(t('common.error'), t('sellerBid.selectBid'));
      return;
    }
    setEndBidSubmitting(true);
    try {
      await apiClient.post(
        `/listings/${listingId}/end-bid`,
        buildSoldEndBidBody(winningBidId)
      );
      closeSellerSheets();
      Alert.alert(t('common.success'), t('sellerBid.bidEnded'));
      fetchListingDetails();
    } catch (error) {
      logApiError('ListingDetailsScreen.endBidSold', error);
      if (bidErrorShouldCloseSellerUi(error)) {
        handleSellerAuctionGone(error);
        return;
      }
      Alert.alert(
        t('common.error'),
        bidErrorI18nKey(error)
          ? t(bidErrorI18nKey(error))
          : getApiErrorMessage(error, t('sellerBid.endFailed'))
      );
      if (isInvalidWinningBidError(error)) {
        setSelectedWinningBidId(null);
        fetchSellerBids();
      }
    } finally {
      setEndBidSubmitting(false);
    }
  };

  const submitEndBidCancel = async () => {
    if (endBidSubmitting || extendBidSubmitting || listAgainSubmitting) return;
    setEndBidSubmitting(true);
    try {
      await apiClient.post(`/listings/${listingId}/end-bid`, buildCancelEndBidBody());
      closeSellerSheets();
      Alert.alert(t('common.success'), t('sellerBid.bidCancelled'));
      fetchListingDetails();
    } catch (error) {
      logApiError('ListingDetailsScreen.endBidCancel', error);
      if (bidErrorShouldCloseSellerUi(error)) {
        handleSellerAuctionGone(error);
        return;
      }
      Alert.alert(
        t('common.error'),
        bidErrorI18nKey(error)
          ? t(bidErrorI18nKey(error))
          : getApiErrorMessage(error, t('sellerBid.endFailed'))
      );
    } finally {
      setEndBidSubmitting(false);
    }
  };

  const openExtendSheet = () => {
    setExtendHours(null);
    setSellerSheet('extend');
  };

  const submitExtendBid = async (hours = extendHours) => {
    if (endBidSubmitting || extendBidSubmitting || listAgainSubmitting) return;
    if (!isAllowedAuctionDuration(hours)) {
      Alert.alert(t('common.error'), t('sellerBid.selectExtension'));
      return;
    }
    setExtendBidSubmitting(true);
    try {
      const response = await apiClient.post(
        `/listings/${listingId}/extend-bid`,
        buildExtendBidBody(hours)
      );
      setListing((prev) => applyExtendToListing(prev, response.data));
      closeSellerSheets();
      Alert.alert(t('common.success'), t('sellerBid.bidExtended'));
      fetchListingDetails();
    } catch (error) {
      logApiError('ListingDetailsScreen.extendBid', error);
      if (bidErrorShouldCloseSellerUi(error)) {
        handleSellerAuctionGone(error);
        return;
      }
      Alert.alert(
        t('common.error'),
        bidErrorI18nKey(error)
          ? t(bidErrorI18nKey(error))
          : getApiErrorMessage(error, t('sellerBid.extendFailed'))
      );
      if (bidErrorNeedsRefresh(error)) {
        fetchListingDetails();
      }
    } finally {
      setExtendBidSubmitting(false);
    }
  };

  const openListAgainSheet = () => {
    if (sellerBusy || !canListAgain(listing)) return;
    setListAgainHours(DEFAULT_AUCTION_DURATION_HOURS);
    setSellerSheet('listAgain');
  };

  const submitListAgain = async (hours = listAgainHours) => {
    if (endBidSubmitting || extendBidSubmitting || listAgainSubmitting) return;
    if (!isAllowedAuctionDuration(hours)) {
      Alert.alert(t('common.error'), t('sellerBid.selectDuration'));
      return;
    }
    setListAgainSubmitting(true);
    try {
      await apiClient.post(
        `/listings/${listingId}/list-again`,
        buildListAgainBody(hours)
      );
      closeSellerSheets();
      Alert.alert(
        t('sellerBid.listAgainSuccessTitle'),
        t('sellerBid.listAgainSuccess')
      );
      fetchListingDetails();
    } catch (error) {
      logApiError('ListingDetailsScreen.listAgain', error);
      const message = bidErrorI18nKey(error)
        ? t(bidErrorI18nKey(error))
        : getApiErrorMessage(error, t('sellerBid.listAgainFailed'));
      Alert.alert(t('common.error'), message);
      if (bidErrorShouldCloseListAgain(error)) {
        closeSellerSheets();
        fetchListingDetails();
      }
    } finally {
      setListAgainSubmitting(false);
    }
  };

  const confirmListAgain = (hours = listAgainHours) => {
    if (sellerBusy) return;
    if (!isAllowedAuctionDuration(hours)) {
      Alert.alert(t('common.error'), t('sellerBid.selectDuration'));
      return;
    }
    const durationLabel = t(auctionDurationLabelKey(hours));
    Alert.alert(
      t('sellerBid.listAgain'),
      fillTemplate(t('sellerBid.confirmListAgain'), { duration: durationLabel }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sellerBid.listAgain'),
          onPress: () => submitListAgain(hours),
        },
      ]
    );
  };

  const formatOfferAmount = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value ?? '');
    return num.toFixed(2);
  };

  const formatOfferDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const callSeller = () => {
    openPhoneDialer(listing?.phone_number, {
      unavailableMessage: t('common.sellerPhoneUnavailable'),
      dialerUnavailableMessage: t('common.phoneDialerUnavailable'),
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={[styles.loadingHeader, getFlexDirection(isRTL, 'row')]}>
          <IconButton
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <DetailScreenSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
          <IconButton
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon={loadError ? 'cloud-offline-outline' : 'alert-circle-outline'}
          title={loadError ? t('common.error') : t('listingDetails.listingNotFound')}
          description={loadError ? t('common.somethingWentWrong') : undefined}
          actionLabel={loadError ? t('common.retry') : t('common.back')}
          onAction={loadError ? retryListingDetails : () => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const isOwner = Boolean(listing.is_owner);
  const {
    canEdit,
    canResubmit,
    canHide,
    canUnhide,
    canMarkSold,
    canDelete,
  } = listingOwnerCapabilities(listing, { isOwner });
  const conditionLabel = localizeConditionName(listing.condition_name, t);
  const auctionEndParts =
    showManageLiveBid && auction?.ends_at
      ? formatAuctionEndParts(auction.ends_at, t, language)
      : null;
  const locationLabel = formatListingLocation(listing, language);
  const descriptionText =
    language === 'ar' && listing.description_ar
      ? listing.description_ar
      : listing.description_en || listing.description || '';
  const hasDescription = Boolean(
    (listing.description_en || listing.description_ar || listing.description) &&
      descriptionText
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <IconButton
          name={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <View style={styles.headerTitleBlock}>
          <Text
            style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}
            numberOfLines={1}
          >
            {t('listingDetails.listingDetails')}
          </Text>
          {showManageLiveBid ? (
            <Text
              style={[styles.headerId, { color: colors.textMuted }, getTextAlign(isRTL, 'center')]}
              numberOfLines={1}
            >
              {fillTemplate(t('listingDetails.listingId'), {
                id: String(listing?.id ?? listingId),
              })}
            </Text>
          ) : null}
        </View>
        {isOwner ? (
          <IconButton
            name="share-outline"
            onPress={handleShareListing}
            accessibilityLabel={t('listingDetails.shareListing')}
          />
        ) : (
          <View style={[styles.headerActions, getFlexDirection(isRTL, 'row')]}>
            <FavoriteButton
              listingId={listingId}
              variant="plain"
              size={22}
              style={styles.headerAction}
              onToggled={(isNowFavorite) => {
                showToast(
                  isNowFavorite
                    ? t('savedListings.savedToast') || 'Saved to your list'
                    : t('savedListings.removedToast') || 'Removed from saved'
                );
              }}
            />
            {isBid ? (
              <IconButton
                name="share-outline"
                onPress={handleShareListing}
                accessibilityLabel={t('listingDetails.shareListing')}
              />
            ) : null}
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          showPlaceBid ? styles.contentContainerWithComposer : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed gallery */}
        {images.length > 0 ? (
          <View
            style={
              showManageLiveBid
                ? [
                    styles.galleryFrameLiveSeller,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      shadowColor: colors.shadow,
                    },
                  ]
                : undefined
            }
          >
          <View style={[styles.galleryWrap, showManageLiveBid && styles.galleryWrapLiveSeller]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const pageWidth = showManageLiveBid
                  ? SCREEN_WIDTH - space[5] * 2
                  : SCREEN_WIDTH;
                const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                setCurrentImageIndex(index);
              }}
            >
              {images.map((image, index) => (
                <TouchableOpacity
                  key={image.id}
                  activeOpacity={0.95}
                  onPress={() => {
                    setSelectedImageIndex(index);
                    setImageModalVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(image.image_url) }}
                    style={[
                      styles.galleryImage,
                      showManageLiveBid && styles.galleryImageLiveSeller,
                    ]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {images.length > 1 ? (
              showManageLiveBid ? (
                <>
                  <View
                    style={[
                      styles.liveGalleryCount,
                      isRTL ? { left: space[3] } : { right: space[3] },
                    ]}
                  >
                    <Text style={styles.liveGalleryCountText}>
                      {currentImageIndex + 1} / {images.length}
                    </Text>
                  </View>
                  <View style={styles.liveGalleryDots}>
                    {images.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.liveGalleryDot,
                          currentImageIndex === index && styles.liveGalleryDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : (
              <View style={styles.galleryChrome}>
                <View style={styles.dotsRow}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        currentImageIndex === index && styles.dotActive,
                        index > 0 && { marginLeft: 6 },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.counterPill}>
                  <Text style={styles.counterText}>
                    {currentImageIndex + 1} / {images.length}
                  </Text>
                </View>
              </View>
              )
            ) : null}
          </View>
          </View>
        ) : (
          <View
            style={
              showManageLiveBid
                ? [
                    styles.galleryFrameLiveSeller,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.border,
                      shadowColor: colors.shadow,
                    },
                  ]
                : undefined
            }
          >
          <View
            style={[
              styles.galleryPlaceholder,
              showManageLiveBid && styles.galleryWrapLiveSeller,
              showManageLiveBid && styles.galleryImageLiveSeller,
              {
                backgroundColor: showManageLiveBid
                  ? colors.surfaceContainerLow
                  : colors.primary,
              },
            ]}
          >
            <Image
              source={GALLERY_FALLBACK}
              style={[
                styles.galleryFallbackImage,
                showManageLiveBid && styles.galleryFallbackLiveSeller,
              ]}
              resizeMode="contain"
            />
          </View>
          </View>
        )}

        <View style={[styles.body, showManageLiveBid && styles.bodyLiveSeller]}>
          {listing.status === 'hidden' && isOwner ? (
            <View
              style={[
                styles.notice,
                { backgroundColor: colors.surfaceContainerLow },
                getFlexDirection(isRTL, 'row'),
              ]}
            >
              <Ionicons name="eye-off-outline" size={18} color={colors.textSecondary} />
              <Text
                style={[
                  styles.noticeText,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.hiddenNotice')}
              </Text>
            </View>
          ) : null}

          {showManageLiveBid ? (
            <View style={styles.liveIdentity}>
              <Text
                style={[
                  styles.title,
                  styles.liveSellerTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {getListingDisplayName(listing.brand_name, listing.model_name)}
              </Text>
              {conditionLabel || locationLabel ? (
                <View style={[styles.liveMetaRow, getFlexDirection(isRTL, 'row')]}>
                  {conditionLabel ? (
                    <Text style={[styles.liveCondition, { color: colors.text }]}>
                      {conditionLabel}
                    </Text>
                  ) : null}
                  {conditionLabel && locationLabel ? (
                    <Text style={[styles.liveMetaDot, { color: colors.textMuted }]}>•</Text>
                  ) : null}
                  {locationLabel ? (
                    <Text style={[styles.liveLocation, { color: colors.textMuted }]}>
                      {locationLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {showManageLiveBid && auction ? (
            <View
              style={[
                styles.sellerLiveHero,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.sellerPriceLabel,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {auctionHasBids(auction)
                  ? t('bids.currentHighestBid')
                  : t('bids.startingPrice')}
              </Text>
              <Text
                style={[
                  styles.sellerLivePrice,
                  { color: colors.primary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {auctionHasBids(auction)
                  ? auction.current_highest_bid
                  : auction.starting_price}
                <Text style={[styles.sellerLiveCurrency, { color: colors.primary }]}> JOD</Text>
              </Text>
              <Text
                style={[
                  styles.sellerBidCount,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {auctionHasBids(auction)
                  ? fillTemplate(t('bids.bidCountWithNumber'), {
                      count: String(auction.bid_count ?? 0),
                    })
                  : t('bids.noBidsYet')}
              </Text>
              <View
                style={[
                  styles.timePanel,
                  {
                    backgroundColor: isDarkMode
                      ? colors.surfaceContainer
                      : colors.surfaceContainerLow,
                  },
                  getFlexDirection(isRTL, 'row'),
                ]}
              >
                <View style={styles.timeCopy}>
                  <Text
                    style={[
                      styles.timePanelLabel,
                      { color: colors.textMuted },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('bids.timeRemaining')}
                  </Text>
                  <Text
                    style={[
                      styles.timePanelClock,
                      { color: colors.text },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {countdown.valid && !countdown.expired
                      ? countdown.clockLabel || countdown.label
                      : t('bids.auctionEnded')}
                    </Text>
                </View>
                {auctionEndParts ? (
                  <View style={[styles.timeDivider, { backgroundColor: colors.outlineVariant }]} />
                ) : null}
                {auctionEndParts ? (
                  <View
                    style={[
                      styles.timeEndCopy,
                      { alignItems: isRTL ? 'flex-start' : 'flex-end' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeEndDay,
                        { color: colors.textMuted },
                        getTextAlign(isRTL, 'right'),
                      ]}
                      numberOfLines={1}
                    >
                      {auctionEndParts.dayLabel}
                    </Text>
                    <Text
                      style={[
                        styles.timeEndClock,
                        { color: colors.text },
                        getTextAlign(isRTL, 'right'),
                      ]}
                    >
                      {auctionEndParts.time}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.sellerLiveActions}>
                <Button
                  onPress={openReceivedBids}
                  disabled={sellerBusy}
                  style={[styles.sellerPrimaryCta, { shadowColor: colors.primary }]}
                  accessibilityLabel={
                    auction.bid_count != null
                      ? fillTemplate(t('sellerBid.viewBiddersWithCount'), {
                          count: String(auction.bid_count),
                        })
                      : t('sellerBid.viewBidders')
                  }
                >
                  <View style={[styles.sellerPrimaryInner, getFlexDirection(isRTL, 'row')]}>
                    <Text style={[styles.sellerPrimaryLabel, { color: colors.onPrimary }]}>
                      {auction.bid_count != null
                        ? fillTemplate(t('sellerBid.viewBiddersWithCount'), {
                            count: String(auction.bid_count),
                          })
                        : t('sellerBid.viewBidders')}
                    </Text>
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={18}
                      color={colors.onPrimary}
                    />
                  </View>
                </Button>
                <View style={[styles.sellerActionRow, getFlexDirection(isRTL, 'row')]}>
                  {showExtendBid ? (
                    <Button
                      variant="outline"
                      fullWidth={false}
                      onPress={openExtendSheet}
                      disabled={sellerBusy || extendBidSubmitting}
                      loading={extendBidSubmitting}
                      style={[styles.sellerHalfButton, { borderColor: colors.border }]}
                      accessibilityLabel={t('sellerBid.extendBidDuration')}
                    >
                      <View style={[styles.sellerHalfInner, getFlexDirection(isRTL, 'row')]}>
                        <Ionicons name="time-outline" size={15} color={colors.text} />
                        <Text
                          style={[styles.sellerHalfLabel, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {t('sellerBid.extendBidDuration')}
                        </Text>
                      </View>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    fullWidth={false}
                    onPress={openEndBidSheet}
                    disabled={sellerBusy || endBidSubmitting}
                    loading={endBidSubmitting}
                    style={[
                      styles.sellerHalfButton,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(248, 113, 113, 0.16)'
                          : 'rgba(239, 68, 68, 0.10)',
                        borderColor: colors.error,
                      },
                    ]}
                    accessibilityLabel={t('sellerBid.endBidEarly')}
                  >
                    <View style={[styles.sellerHalfInner, getFlexDirection(isRTL, 'row')]}>
                      <Ionicons name="close" size={15} color={colors.error} />
                      <Text
                        style={[styles.sellerHalfLabel, { color: colors.error }]}
                        numberOfLines={1}
                      >
                        {t('sellerBid.endBidEarly')}
                      </Text>
                    </View>
                  </Button>
                </View>
              </View>
            </View>
          ) : null}

          {/* Hero: buyer and non-live identity. Live sellers render title above the auction. */}
          <View style={styles.heroBlock}>
            {showManageLiveBid && auction ? null : !isBid || isOwner ? (
              <Text style={[styles.price, { color: colors.primary }]}>
                {listing.price}
                <Text style={[styles.currency, { color: colors.primary }]}> JOD</Text>
              </Text>
            ) : auction ? (
              <View>
                <View style={[styles.bidSummaryRow, getFlexDirection(isRTL, 'row')]}>
                  <View style={styles.bidSummaryCopy}>
                    <Text
                      style={[
                        styles.bidEyebrow,
                        { color: colors.textSecondary },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {auctionHasBids(auction)
                        ? t('bids.currentHighestBid')
                        : t('bids.startingPrice')}
                    </Text>
                    <Text
                      style={[styles.price, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}
                    >
                      {auctionHasBids(auction)
                        ? auction.current_highest_bid
                        : auction.starting_price}
                      <Text style={[styles.currency, { color: colors.primary }]}> JOD</Text>
                    </Text>
                    {auction.bid_count > 0 ? (
                      <Text
                        style={[
                          styles.bidCountHint,
                          { color: colors.textMuted },
                          getTextAlign(isRTL, 'auto'),
                        ]}
                      >
                        {fillTemplate(t('bids.bidCountWithNumber'), {
                          count: String(auction.bid_count),
                        })}
                      </Text>
                    ) : auction.auction_status === 'live' ? (
                      <Text
                        style={[
                          styles.bidCountHint,
                          { color: colors.textMuted },
                          getTextAlign(isRTL, 'auto'),
                        ]}
                      >
                        {t('bids.noBidsYet')}
                      </Text>
                    ) : null}
                  </View>
                  {countdown.valid &&
                  auction.auction_status === 'live' &&
                  !countdown.expired ? (
                    <View
                      style={[
                        styles.endingPill,
                        {
                          backgroundColor: isDarkMode
                            ? 'rgba(251, 191, 36, 0.16)'
                            : 'rgba(255, 237, 213, 0.95)',
                        },
                      ]}
                    >
                      <Text style={[styles.endingEyebrow, { color: colors.warning }]}>
                        {t('bids.endingIn')}
                      </Text>
                      <Text style={[styles.endingClock, { color: colors.warning }]}>
                        {countdown.clockLabel || countdown.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {auction.auction_status === 'pending_start' ? (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    {t('bids.pendingStart')}
                  </Text>
                ) : null}
                {auction.auction_status === 'ended' ||
                auction.auction_status === 'completed' ||
                auction.auction_status === 'cancelled' ? (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    {t('bids.auctionEnded')}
                  </Text>
                ) : null}
                {!isOwner && auction.has_my_bids && auction.my_highest_bid != null ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: colors.text },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('bids.yourHighestBid')} {formatJod(auction.my_highest_bid)}
                    {isViewerHighestBidder(auction)
                      ? ` · ${t('bids.youAreHighest')}`
                      : isViewerOutbid(auction)
                        ? ` · ${t('bids.youAreOutbid')}`
                        : ''}
                  </Text>
                ) : null}
                {!isOwner ? (
                  <Button
                    label={t('bids.viewYourBids')}
                    variant="tertiary"
                    onPress={openMyBidsHistory}
                    style={styles.viewYourBidsBtn}
                  />
                ) : null}
                <View style={styles.recentBidsBlock}>
                  <View style={[styles.recentBidsHeader, getFlexDirection(isRTL, 'row')]}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.text, marginBottom: 0 },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {t('bids.recentBids')}
                    </Text>
                    <Text
                      style={[
                        styles.recentBidsCount,
                        { color: colors.textMuted },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {fillTemplate(t('bids.bidCountWithNumber'), {
                        count: String(auction.bid_count ?? 0),
                      })}
                    </Text>
                  </View>
                  {Number(auction.bid_count) === 0 ? (
                    <Text
                      style={[
                        styles.helperText,
                        { color: colors.textSecondary },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {t('bids.noBidsYet')}
                    </Text>
                  ) : publicBidsLoading && publicBids.length === 0 ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={styles.recentBidsSpinner}
                    />
                  ) : publicBidsError && publicBids.length === 0 ? (
                    <Text
                      style={[
                        styles.helperText,
                        { color: colors.textSecondary },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {t('bids.loadFailed')}
                    </Text>
                  ) : (
                    publicBids.map((bid, index) => (
                      <View
                        key={`public-bid-${index}`}
                        style={[styles.recentBidRow, getFlexDirection(isRTL, 'row')]}
                      >
                        <Text
                          style={[
                            styles.recentBidAmount,
                            { color: colors.text },
                            getTextAlign(isRTL, 'auto'),
                          ]}
                        >
                          {formatJod(bid.amount)}
                        </Text>
                        <Text
                          style={[
                            styles.recentBidTime,
                            { color: colors.textMuted },
                            getTextAlign(isRTL, 'auto'),
                          ]}
                        >
                          {formatBidTimeAgo(bid.created_at, nowMs, t)}
                        </Text>
                      </View>
                    ))
                  )}
                  {publicBidsHasMore ? (
                    <Text
                      style={[
                        styles.viewAllBidsText,
                        { color: colors.textSecondary },
                        getTextAlign(isRTL, 'auto'),
                      ]}
                    >
                      {t('bids.viewAllBids')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('bids.auctionUnavailable')}
              </Text>
            )}

            {showManageLiveBid ? null : (
            <View style={[styles.titleRow, getFlexDirection(isRTL, 'row')]}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, flex: 1 },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {getListingDisplayName(listing.brand_name, listing.model_name)}
              </Text>
              {isOwner ? (
                <View
                  style={[
                    styles.ownerChip,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                >
                  <Text style={[styles.ownerChipText, { color: colors.primary }]}>
                    {t('listingDetails.yourListing')}
                  </Text>
                </View>
              ) : null}
              {listing.sale_type === 'bid' && isOwner && !showManageLiveBid ? (
                <View
                  style={[
                    styles.ownerChip,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                >
                  <Text style={[styles.ownerChipText, { color: colors.primary }]}>
                    {t('myListings.bid')}
                  </Text>
                </View>
              ) : null}
            </View>
            )}

            {showManageLiveBid ? null : (
            <View style={[styles.metaRow, getFlexDirection(isRTL, 'row')]}>
              <ConditionPill
                conditionName={listing.condition_name}
                label={conditionLabel}
              />

              {locationLabel ? (
                <View style={[styles.locationRow, getFlexDirection(isRTL, 'row')]}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            )}
          </View>

          {isBid && isOwner && !showManageLiveBid ? (
            <Card style={styles.sectionCard} elevated>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('myListings.bid')}
              </Text>
              {!auction ? (
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('bids.auctionUnavailable')}
                </Text>
              ) : (
                <View style={styles.auctionRows}>
                  {auction.auction_status === 'pending_start' ? (
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      {t('bids.pendingStart')}
                    </Text>
                  ) : null}
                  {auction.auction_status === 'ended' ||
                  auction.auction_status === 'completed' ||
                  auction.auction_status === 'cancelled' ? (
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      {t('bids.auctionEnded')}
                    </Text>
                  ) : null}
                  {auction.starting_price != null ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.startingPrice')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.text }]}>
                        {formatJod(auction.starting_price)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                      {t('bids.currentHighestBid')}
                    </Text>
                    <Text style={[styles.auctionValue, { color: colors.text }]}>
                      {auctionHasBids(auction)
                        ? formatJod(auction.current_highest_bid)
                        : t('bids.noBidsYet')}
                    </Text>
                  </View>
                  {auction.minimum_next_bid != null &&
                  String(auction.minimum_next_bid).trim() !== '' ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.minimumNextBid')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.text }]}>
                        {formatJod(auction.minimum_next_bid)}
                      </Text>
                    </View>
                  ) : null}
                  {auction.maximum_bid != null && String(auction.maximum_bid).trim() !== '' ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.maximumBid')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.text }]}>
                        {formatJod(auction.maximum_bid)}
                      </Text>
                    </View>
                  ) : null}
                  {countdown.valid ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.timeRemaining')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.text }]}>
                        {countdown.expired ? t('bids.auctionEnded') : countdown.label}
                      </Text>
                    </View>
                  ) : null}
                  {auction.bid_count != null ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.bidCount')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.text }]}>
                        {String(auction.bid_count)}
                      </Text>
                    </View>
                  ) : null}
                  {!isOwner && auction.has_my_bids && auction.my_highest_bid != null ? (
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {t('bids.yourBid')}
                      </Text>
                      <Text style={[styles.auctionValue, { color: colors.primary }]}>
                        {formatJod(auction.my_highest_bid)}
                      </Text>
                    </View>
                  ) : null}
                  {!isOwner ? (
                    <Button
                      label={t('bids.viewYourBids')}
                      variant="outline"
                      onPress={openMyBidsHistory}
                      style={{ marginTop: space[2] }}
                    />
                  ) : null}
                </View>
              )}
            </Card>
          ) : null}

          {/* Declined notice (owner) */}
          {isOwner && listing.status === 'declined' ? (
            <Card style={styles.sectionCard} elevated>
              <View style={[styles.rejectionBadge, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="close-circle" size={16} color={colors.error} />
                <Text style={[styles.rejectionBadgeText, { color: colors.error }]}>
                  {t('listingDetails.rejectedBadge')}
                </Text>
              </View>
              <Text
                style={[
                  styles.rejectionTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.rejectedTitle')}
              </Text>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                {t('listingDetails.rejectedReasonLabel')}
              </Text>
              <Text
                style={[
                  styles.rejectionReason,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {typeof listing.decline_reason === 'string' && listing.decline_reason.trim()
                  ? listing.decline_reason.trim()
                  : t('listingDetails.rejectedNoReason')}
              </Text>
              <Text
                style={[
                  styles.helperText,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.rejectedHelper')}
              </Text>
              <Button
                label={t('listingDetails.editListing')}
                onPress={() => navigation.navigate('CreateListing', { listingId })}
                style={{ marginTop: space[3] }}
              />
            </Card>
          ) : null}

          {/* Owner insights */}
          {isOwner ? (
            <Card style={styles.sectionCard} elevated>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.insights')}
              </Text>
              <View style={[styles.insightsGrid, getFlexDirection(isRTL, 'row')]}>
                <View
                  style={[
                    styles.insightTile,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                >
                  <Text
                    style={[styles.insightValue, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {listing.views ?? '—'}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>
                    {t('listingDetails.viewsLabel')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.insightTile,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                >
                  <Text
                    style={[styles.insightValue, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {listing.favorites_count ?? '—'}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>
                    {t('listingDetails.favoritesLabel')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.insightTile,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                  onPress={() =>
                    navigation.push('Offers', {
                      initialSegment: 'received',
                      listingId,
                    })
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('listingDetails.offersLabel')}
                >
                  <View
                    style={[styles.insightValueRow, getFlexDirection(isRTL, 'row')]}
                  >
                    <Text
                      style={[
                        styles.insightValue,
                        styles.insightValueFlex,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {listing.offers_count ?? '—'}
                    </Text>
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>
                    {t('listingDetails.offersLabel')}
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.insightTile,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                >
                  <View style={styles.insightStatusValue}>
                    <StatusBadge
                      status={listing.status}
                      label={getStatusLabel(listing.status)}
                      style={styles.insightStatusBadge}
                      textStyle={styles.insightStatusText}
                    />
                  </View>
                  <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>
                    {t('listingDetails.statusLabel')}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Specs — 2-column Apple-style tiles */}
          <View style={styles.specsSection}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('listingDetails.specifications') || 'Specifications'}
            </Text>
            <View style={styles.specsGrid}>
              {buildListingSpecItems(listing, { t, conditionLabel }).map((item) => (
                  <SpecTile
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    colorDot={item.colorDot}
                    colors={colors}
                  />
                ))}
            </View>
          </View>

          {/* Description */}
          {hasDescription ? (
            <Card style={[styles.sectionCard, styles.descriptionCard]} elevated>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.descriptionSectionTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.description')}
              </Text>
              <Text
                style={[
                  styles.descriptionText,
                  { color: colors.textSecondary },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {descriptionText || t('listingDetails.noDescription')}
              </Text>
            </Card>
          ) : null}

          {showManageLiveBid ? (
            <Card style={styles.sectionCard} elevated>
              <View
                style={[
                  styles.notice,
                  { backgroundColor: colors.surfaceContainerLow },
                  getFlexDirection(isRTL, 'row'),
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <View style={styles.sellerLiveLockCopy}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text, marginBottom: space[1] },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('sellerBid.liveAuctionLockedTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.noticeText,
                      { color: colors.textSecondary },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('sellerBid.liveAuctionLockedBody')}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Seller / Your listing */}
          {showManageLiveBid ? null : (
          <Card style={[styles.sectionCard, styles.sellerCard]} elevated>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {isOwner ? t('listingDetails.yourListing') : t('listingDetails.seller')}
            </Text>

            <View style={[styles.sellerTopRow, getFlexDirection(isRTL, 'row')]}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                {isOwner ? (
                  <Ionicons name="person" size={22} color={colors.primary} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: colors.primary }]}>
                    {sellerInitials(listing)}
                  </Text>
                )}
              </View>
              <View style={styles.sellerInfo}>
                <Text
                  style={[
                    styles.sellerName,
                    { color: colors.text },
                    getTextAlign(isRTL, 'auto'),
                  ]}
                >
                  {isOwner
                    ? t('listingDetails.you')
                    : `${listing.first_name || ''} ${listing.last_name || ''}`.trim()}
                </Text>
                {isOwner ? (
                  <Text
                    style={[
                      styles.helperText,
                      { color: colors.textSecondary },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {t('listingDetails.yourListingHint')}
                  </Text>
                ) : locationLabel ? (
                  <Text
                    style={[styles.sellerLocation, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {locationLabel}
                  </Text>
                ) : null}
              </View>

              {!isOwner && listing.phone_number ? (
                isBid ? (
                  <TouchableOpacity
                    style={[styles.callTextBtn, getFlexDirection(isRTL, 'row')]}
                    onPress={callSeller}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('listingDetails.call')}
                  >
                    <Ionicons name="call-outline" size={18} color={colors.primary} />
                    <Text style={[styles.callTextLabel, { color: colors.primary }]}>
                      {t('listingDetails.call')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.callCircle,
                      ambientElevation,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={callSeller}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('listingDetails.call')}
                  >
                    <Ionicons name="call" size={20} color="#ffffff" />
                  </TouchableOpacity>
                )
              ) : null}
            </View>

            {shouldShowOfferCard(listing, isOwner) ? (
              <View
                style={[
                  styles.offerCard,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                  {t('offers.yourOffer')}
                </Text>
                <Text style={[styles.offerAmount, { color: colors.primary }]}>
                  {formatOfferAmount(listing.my_offer_amount)} JOD
                </Text>

                <View style={[styles.offerMetaRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t('offers.statusLabel')}
                  </Text>
                  <OfferStatusBadge status={listing.my_offer_status} />
                </View>

                {(listing.my_offer_status === 'accepted' ||
                  listing.my_offer_status === 'rejected' ||
                  listing.my_offer_status === 'withdrawn') && (
                  <Text
                    style={[
                      styles.offerHeadline,
                      {
                        color:
                          listing.my_offer_status === 'accepted'
                            ? '#266931'
                            : listing.my_offer_status === 'rejected'
                              ? colors.error
                              : colors.textSecondary,
                      },
                      getTextAlign(isRTL, 'auto'),
                    ]}
                  >
                    {listing.my_offer_status === 'accepted'
                      ? t('offers.offerAccepted')
                      : listing.my_offer_status === 'rejected'
                        ? t('offers.offerDeclined')
                        : t('offers.offerCancelled')}
                  </Text>
                )}

                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('offers.submitted')} {formatOfferDate(listing.my_offer_created_at)}
                </Text>

                {listing.my_offer_status === 'pending' ? (
                  <Button
                    label={t('offers.editOffer')}
                    onPress={() => openOfferModal(listing.my_offer_amount)}
                    style={{ marginTop: space[3] }}
                  />
                ) : null}

                {(listing.my_offer_status === 'rejected' ||
                  listing.my_offer_status === 'withdrawn') &&
                listing.status === 'approved' ? (
                  <Button
                    label={t('offers.submitNewOffer')}
                    onPress={() => openOfferModal('')}
                    style={{ marginTop: space[3] }}
                  />
                ) : null}
              </View>
            ) : null}

            {shouldShowMakeOffer(listing, isOwner) ? (
              <Button
                label={t('offers.makeAnOffer')}
                onPress={() => openOfferModal('')}
                style={styles.sellerPrimaryCta}
              />
            ) : null}

            {!isOwner && !isBid ? (
              <Button
                label={t('listingDetails.shareListing')}
                variant="outline"
                onPress={handleShareListing}
                style={styles.sellerSecondaryCta}
              />
            ) : null}
          </Card>
          )}

          {/* Owner management */}
          {isOwner && !showManageLiveBid ? (
            <Card style={styles.sectionCard} elevated>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text },
                  getTextAlign(isRTL, 'auto'),
                ]}
              >
                {t('listingDetails.manageListing')}
              </Text>

              <View style={ownerActionListStyle}>
                {canEdit || canResubmit ? (
                  <OwnerActionRow
                    icon="pencil"
                    label={t('myListings.edit')}
                    onPress={() => navigation.navigate('CreateListing', { listingId })}
                    disabled={ownerActionBusy}
                    variant="primary"
                  />
                ) : null}

                {canHide ? (
                  <OwnerActionRow
                    icon="eye-off-outline"
                    label={t('myListings.hideListing')}
                    onPress={handleHideListing}
                    disabled={ownerActionBusy}
                  />
                ) : null}

                {canUnhide ? (
                  <OwnerActionRow
                    icon="eye-outline"
                    label={t('myListings.unhideListing')}
                    onPress={handleUnhideListing}
                    loading={ownerActionBusy}
                    disabled={ownerActionBusy}
                  />
                ) : null}

                {canMarkSold ? (
                  <OwnerActionRow
                    icon="pricetag-outline"
                    label={t('myListings.markAsSold')}
                    onPress={handleMarkAsSold}
                    disabled={ownerActionBusy}
                  />
                ) : null}

                <OwnerActionRow
                  icon="share-social-outline"
                  label={t('listingDetails.shareListing')}
                  onPress={handleShareListing}
                  disabled={ownerActionBusy || sellerBusy}
                />

                {showListAgain ? (
                  <OwnerActionRow
                    icon="refresh-outline"
                    label={t('sellerBid.listAgain')}
                    onPress={openListAgainSheet}
                    disabled={sellerBusy || listAgainSubmitting}
                    loading={listAgainSubmitting}
                    variant="primary"
                  />
                ) : null}

                {canDelete ? (
                  <OwnerActionRow
                    icon="trash-outline"
                    label={t('myListings.deleteListing')}
                    onPress={handleDeleteListing}
                    disabled={ownerActionBusy}
                    variant="danger"
                  />
                ) : null}
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>
      {showPlaceBid && auction ? (
        <View
          style={[
            styles.bidComposer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, space[3]),
            },
          ]}
        >
          {auction.minimum_next_bid != null ? (
            <Text
              style={[
                styles.bidComposerMin,
                { color: colors.textSecondary },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('bids.minNextBid')}: {formatJod(auction.minimum_next_bid)}
            </Text>
          ) : null}
          {auction.maximum_bid != null && String(auction.maximum_bid).trim() !== '' ? (
            <Text
              style={[
                styles.bidComposerMax,
                { color: colors.textMuted },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('bids.maximumBid')}: {formatJod(auction.maximum_bid)}
            </Text>
          ) : null}
          <View
            style={[
              styles.bidAmountField,
              {
                backgroundColor: colors.surface,
                borderColor: bidAmountError ? colors.error : colors.border,
              },
              getFlexDirection(isRTL, 'row'),
            ]}
          >
            <TextInput
              style={[
                styles.bidAmountInput,
                { color: colors.text },
                getTextAlign(isRTL, 'auto'),
              ]}
              value={bidAmount}
              onChangeText={(value) => {
                setBidAmount(value);
                setBidAmountError(null);
              }}
              placeholder={
                auction.minimum_next_bid != null
                  ? String(auction.minimum_next_bid)
                  : undefined
              }
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              editable={!submittingBid}
            />
            <Text style={[styles.bidAmountSuffix, { color: colors.textMuted }]}>JOD</Text>
          </View>
          {bidAmountError ? (
            <Text style={[styles.bidAmountError, { color: colors.error }]}>{bidAmountError}</Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.placeBidCta,
              { backgroundColor: colors.primary },
              submittingBid && styles.primaryButtonDisabled,
            ]}
            onPress={submitBid}
            disabled={submittingBid}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('bids.placeBid')}
          >
            {submittingBid ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <View style={[styles.placeBidCtaRow, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="add" size={20} color={colors.onPrimary} />
                <Text style={[styles.placeBidCtaText, { color: colors.onPrimary }]}>
                  {t('bids.placeBid')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      </KeyboardAvoidingView>

      {/* Offer modal */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeOfferModal}
      >
        <View style={styles.offerOverlay}>
          <View
            style={[
              styles.offerSheet,
              ambientElevation,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.sheetHandleWrap}>
              <View
                style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]}
              />
            </View>
            <Text
              style={[
                styles.offerTitle,
                { color: colors.text },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {listing.has_my_offer && listing.my_offer_status === 'pending'
                ? t('offers.editOffer')
                : t('offers.makeAnOffer')}
            </Text>
            <Text
              style={[
                styles.offerSubtitle,
                { color: colors.textSecondary },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('offers.askingPriceIs')} {listing.price} JOD
            </Text>

            <TextInput
              style={[
                styles.offerInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
                getTextAlign(isRTL, 'auto'),
              ]}
              value={offerAmount}
              onChangeText={setOfferAmount}
              placeholder={t('offers.offerAmountPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />

            <View style={[styles.offerActions, getFlexDirection(isRTL, 'row')]}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={closeOfferModal}
                disabled={submittingOffer}
                style={styles.offerActionBtn}
              />
              <Button
                label={t('offers.submit')}
                onPress={submitOffer}
                loading={submittingOffer}
                disabled={submittingOffer}
                style={styles.offerActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <BottomSheet
        open={bidSheetOpen}
        onClose={closeBidSheet}
        title={t('bids.placeBid')}
        maxHeight="80%"
      >
        {auction ? (
          <View style={styles.bidSheetBody}>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {t('bids.currentHighestBid')}:{' '}
              {auctionHasBids(auction)
                ? formatJod(auction.current_highest_bid)
                : t('bids.noBidsYet')}
            </Text>
            {auction.minimum_next_bid != null ? (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('bids.minimumNextBid')}: {formatJod(auction.minimum_next_bid)}
              </Text>
            ) : null}
            {auction.maximum_bid != null ? (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('bids.maximumBid')}: {formatJod(auction.maximum_bid)}
              </Text>
            ) : null}
            <TextField
              label={t('bids.amountLabel')}
              value={bidAmount}
              onChangeText={(value) => {
                setBidAmount(value);
                setBidAmountError(null);
              }}
              placeholder={
                auction.minimum_next_bid != null
                  ? String(auction.minimum_next_bid)
                  : undefined
              }
              keyboardType="decimal-pad"
              error={bidAmountError}
              editable={!submittingBid}
            />
            <Button
              label={t('bids.placeBid')}
              onPress={submitBid}
              loading={submittingBid}
              disabled={submittingBid}
              style={{ marginTop: space[3], marginBottom: space[4] }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={historySheetOpen}
        onClose={() => setHistorySheetOpen(false)}
        title={t('bids.yourBids')}
        maxHeight="70%"
      >
        <View style={styles.bidSheetBody}>
          {myBidsLoading ? (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {t('common.loading')}
            </Text>
          ) : myBids.length === 0 ? (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {t('bids.noOwnBids')}
            </Text>
          ) : (
            myBids.map((bid) => (
              <View
                key={bid.id}
                style={[
                  styles.historyRow,
                  { backgroundColor: colors.surfaceContainerLow },
                  getFlexDirection(isRTL, 'row'),
                ]}
              >
                <View style={styles.historyCopy}>
                  <Text style={[styles.auctionValue, { color: colors.text }]}>
                    {formatJod(bid.amount)}
                  </Text>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {formatOfferDate(bid.created_at)}
                  </Text>
                </View>
                {bid.is_highest ? (
                  <StatusBadge status="approved" label={t('bids.highest')} />
                ) : null}
              </View>
            ))
          )}
        </View>
      </BottomSheet>

      <BottomSheet
        open={sellerSheet === 'end'}
        onClose={closeSellerSheets}
        title={t('sellerBid.endBid')}
        maxHeight="85%"
      >
        {endStep === 'choose' ? (
          <View style={styles.bidSheetBody}>
            <OwnerActionRow
              icon="pricetag-outline"
              label={t('sellerBid.soldToBidder')}
              onPress={openSoldBidPicker}
              disabled={sellerBusy}
            />
            <OwnerActionRow
              icon="close-circle-outline"
              label={t('sellerBid.noLongerSell')}
              onPress={confirmCancelBid}
              disabled={sellerBusy}
              variant="danger"
            />
          </View>
        ) : (
          <ScrollView style={styles.sellerSheetScroll} keyboardShouldPersistTaps="handled">
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {t('sellerBid.selectBid')}
            </Text>
            {sellerBidsLoading ? (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </Text>
            ) : sellerBids.length === 0 ? (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('sellerBid.noBiddersYet')}
              </Text>
            ) : (
              sellerBids.map((bid) => {
                const selected = selectedWinningBidId === bid.id;
                return (
                  <TouchableOpacity
                    key={bid.id}
                    onPress={() => setSelectedWinningBidId(bid.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${bid.bidder?.name || ''} ${bid.amount}`}
                    style={[
                      styles.historyRow,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderWidth: selected ? 2 : 0,
                        borderColor: selected ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[styles.auctionValue, { color: colors.text, flex: 1 }]}>
                        {bid.bidder?.name || t('sellerBid.bidder')}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={22}
                          color={colors.textMuted}
                        />
                      )}
                    </View>
                    <Text style={[styles.auctionValue, { color: colors.primary }]}>
                      {formatJod(bid.amount)}
                    </Text>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                      {formatOfferDate(bid.created_at)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            <Button
              label={t('sellerBid.confirmSale')}
              onPress={() => {
                const bid = sellerBids.find((row) => row.id === selectedWinningBidId);
                if (!bid) {
                  Alert.alert(t('common.error'), t('sellerBid.selectBid'));
                  return;
                }
                confirmSoldBid(bid);
              }}
              loading={endBidSubmitting}
              disabled={sellerBusy || selectedWinningBidId == null}
              style={{ marginTop: space[3], marginBottom: space[4] }}
            />
          </ScrollView>
        )}
      </BottomSheet>

      <BottomSheet
        open={sellerSheet === 'extend'}
        onClose={closeSellerSheets}
        title={t('sellerBid.extendBid')}
        maxHeight="80%"
      >
        <ScrollView style={styles.sellerSheetScroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('sellerBid.selectExtension')}
          </Text>
          {auctionDurationOptions().map((option) => {
            const selected = Number(extendHours) === Number(option.hours);
            return (
              <TouchableOpacity
                key={option.hours}
                onPress={() => setExtendHours(option.hours)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.historyRow,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderWidth: selected ? 2 : 0,
                    borderColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.auctionValue, { color: colors.text, flex: 1 }]}>
                    {t(auctionDurationLabelKey(option.hours))}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Button
            label={t('sellerBid.extendBid')}
            onPress={() => submitExtendBid(extendHours)}
            loading={extendBidSubmitting}
            disabled={sellerBusy || extendHours == null}
            style={{ marginTop: space[3], marginBottom: space[4] }}
          />
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        open={sellerSheet === 'listAgain'}
        onClose={() => {
          if (listAgainSubmitting) return;
          closeSellerSheets();
        }}
        title={t('sellerBid.listAgain')}
        maxHeight="80%"
      >
        <ScrollView style={styles.sellerSheetScroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('sellerBid.selectDuration')}
          </Text>
          {auctionDurationOptions().map((option) => {
            const selected = Number(listAgainHours) === Number(option.hours);
            return (
              <TouchableOpacity
                key={option.hours}
                onPress={() => !listAgainSubmitting && setListAgainHours(option.hours)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={listAgainSubmitting}
                style={[
                  styles.historyRow,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderWidth: selected ? 2 : 0,
                    borderColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <View style={[styles.auctionRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.auctionValue, { color: colors.text, flex: 1 }]}>
                    {t(auctionDurationLabelKey(option.hours))}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Button
            label={t('sellerBid.listAgain')}
            onPress={() => confirmListAgain(listAgainHours)}
            loading={listAgainSubmitting}
            disabled={sellerBusy || listAgainHours == null}
            style={{ marginTop: space[3], marginBottom: space[4] }}
          />
        </ScrollView>
      </BottomSheet>

      {/* Full-screen image modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>

          <ScrollView
            ref={horizontalScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.modalImageScroll}
            contentOffset={{ x: selectedImageIndex * SCREEN_WIDTH, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setSelectedImageIndex(index);
            }}
            scrollEnabled
            scrollEventThrottle={16}
          >
            {images.map((image) => (
              <View key={image.id} style={styles.modalImageContainer}>
                <ScrollView
                  style={styles.zoomScrollView}
                  contentContainerStyle={styles.zoomScrollViewContent}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  bouncesZoom
                  scrollEventThrottle={16}
                  onScrollBeginDrag={() => {
                    if (horizontalScrollViewRef.current) {
                      horizontalScrollViewRef.current.setNativeProps({
                        scrollEnabled: false,
                      });
                    }
                  }}
                  onScrollEndDrag={() => {
                    setTimeout(() => {
                      if (horizontalScrollViewRef.current) {
                        horizontalScrollViewRef.current.setNativeProps({
                          scrollEnabled: true,
                        });
                      }
                    }, 100);
                  }}
                  onMomentumScrollEnd={() => {
                    if (horizontalScrollViewRef.current) {
                      horizontalScrollViewRef.current.setNativeProps({
                        scrollEnabled: true,
                      });
                    }
                  }}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(image.image_url) }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          {images.length > 1 ? (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1} / {images.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingHeader: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  headerTitle: {
    fontFamily: fonts.headline,
    fontSize: 17,
    textAlign: 'center',
  },
  headerId: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { alignItems: 'center' },
  content: { flex: 1 },
  contentContainer: { paddingBottom: space[10] },
  contentContainerWithComposer: { paddingBottom: space[6] },
  galleryWrap: { position: 'relative' },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
  },
  galleryPlaceholder: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryFallbackImage: {
    width: SCREEN_WIDTH * 0.55,
    height: GALLERY_HEIGHT * 0.72,
  },
  galleryChrome: {
    position: 'absolute',
    bottom: space[3],
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#ffffff',
  },
  counterPill: {
    backgroundColor: 'rgba(26, 28, 28, 0.55)',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
  },
  counterText: {
    color: '#ffffff',
    fontFamily: fonts.labelBold,
    fontSize: 12,
  },
  body: {
    paddingHorizontal: space[5],
    paddingTop: space[6],
    gap: space[6],
  },
  notice: {
    gap: space[2],
    alignItems: 'center',
    padding: space[4],
    borderRadius: radii['2xl'] + 4,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  heroBlock: {
    gap: space[3],
    paddingBottom: space[1],
  },
  bidSummaryRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  bidSummaryCopy: {
    flex: 1,
  },
  bidEyebrow: {
    fontFamily: fonts.labelBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: space[1],
  },
  bidCountHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: space[1],
  },
  endingPill: {
    borderRadius: radii.full,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    alignItems: 'center',
    minWidth: 92,
  },
  endingEyebrow: {
    fontFamily: fonts.labelBold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  endingClock: {
    fontFamily: fonts.headline,
    fontSize: 16,
    marginTop: 2,
  },
  bodyLiveSeller: {
    paddingTop: space[4],
    gap: space[4],
  },
  galleryFrameLiveSeller: {
    marginHorizontal: space[5],
    marginTop: space[3],
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  galleryWrapLiveSeller: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  galleryImageLiveSeller: {
    width: SCREEN_WIDTH - space[5] * 2,
    height: Math.round(Math.min(SCREEN_WIDTH * 0.62, 260)),
  },
  galleryFallbackLiveSeller: {
    width: SCREEN_WIDTH * 0.42,
    height: 160,
  },
  liveGalleryCount: {
    position: 'absolute',
    top: space[3],
    backgroundColor: 'rgba(26, 28, 28, 0.45)',
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  liveGalleryCountText: {
    color: '#ffffff',
    fontFamily: fonts.labelBold,
    fontSize: 11,
  },
  liveGalleryDots: {
    position: 'absolute',
    bottom: space[3],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  liveGalleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  liveGalleryDotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  liveIdentity: {
    gap: 2,
  },
  liveSellerTitle: {
    fontSize: 26,
    lineHeight: 32,
  },
  liveMetaRow: {
    alignItems: 'center',
    gap: space[2],
  },
  liveCondition: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  liveMetaDot: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  liveLocation: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sellerLiveHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: space[4],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  sellerPriceLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sellerLivePrice: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  sellerLiveCurrency: {
    fontFamily: fonts.headline,
    fontSize: 16,
  },
  sellerBidCount: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space[1],
  },
  timePanel: {
    alignItems: 'center',
    marginTop: space[4],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: 16,
  },
  timeCopy: {
    flex: 1,
  },
  timePanelLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timePanelClock: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    marginTop: 2,
  },
  timeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: space[3],
    marginVertical: space[1],
  },
  timeEndCopy: {
    flex: 1,
    flexShrink: 1,
  },
  timeEndDay: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  timeEndClock: {
    fontFamily: fonts.headline,
    fontSize: 15,
    marginTop: 2,
  },
  sellerLiveActions: {
    marginTop: space[4],
    gap: space[3],
  },
  sellerPrimaryCta: {
    minHeight: 50,
    paddingVertical: space[2],
    borderRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  sellerPrimaryInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  sellerPrimaryLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
  },
  sellerActionRow: {
    alignItems: 'stretch',
    gap: space[3],
  },
  sellerHalfButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderRadius: 14,
  },
  sellerHalfInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sellerHalfLabel: {
    fontFamily: fonts.headline,
    fontSize: 14,
    flexShrink: 1,
  },
  sellerLiveLockCopy: {
    flex: 1,
  },
  viewYourBidsBtn: {
    alignSelf: 'flex-start',
    marginTop: space[2],
  },
  recentBidsBlock: {
    marginTop: space[4],
    gap: space[2],
  },
  recentBidsHeader: {
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  recentBidsCount: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  recentBidsSpinner: {
    alignSelf: 'flex-start',
    marginTop: space[1],
  },
  recentBidRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  recentBidAmount: {
    fontFamily: fonts.headline,
    fontSize: 16,
    flex: 1,
  },
  recentBidTime: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  viewAllBidsText: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    marginTop: space[1],
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  currency: {
    fontFamily: fonts.headline,
    fontSize: 20,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: space[2],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  conditionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[4],
    paddingVertical: space[2] + 2,
    borderRadius: radii.full,
  },
  conditionPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  ownerChip: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
    marginTop: 4,
  },
  ownerChipText: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
  },
  locationRow: {
    alignItems: 'center',
    gap: space[1],
    marginTop: space[1],
  },
  locationText: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sectionCard: {
    marginBottom: 0,
    borderRadius: radii['2xl'] + 4,
  },
  sellerCard: {
    overflow: 'visible',
  },
  descriptionCard: {
    paddingVertical: space[5],
    paddingHorizontal: space[5],
  },
  descriptionSectionTitle: {
    marginBottom: space[4],
  },
  sectionTitle: {
    fontFamily: fonts.headline,
    fontSize: 18,
    marginBottom: space[4],
  },
  metaLabel: {
    fontFamily: fonts.label,
    fontSize: 13,
    marginBottom: space[1],
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: space[1],
  },
  specsSection: {
    gap: space[1],
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space[3],
  },
  specTile: {
    width: '48%',
    borderRadius: radii['2xl'],
    paddingVertical: space[4],
    paddingHorizontal: space[3],
    minHeight: 88,
    justifyContent: 'space-between',
  },
  specTileLabel: {
    fontFamily: fonts.label,
    fontSize: 12,
    marginBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  specTileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  specTileValue: {
    fontFamily: fonts.headline,
    fontSize: 17,
    lineHeight: 22,
    flexShrink: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  descriptionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 680,
  },
  sellerTopRow: {
    alignItems: 'center',
    gap: space[3],
    marginBottom: space[2],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInfo: { flex: 1 },
  sellerName: {
    fontFamily: fonts.headline,
    fontSize: 18,
  },
  sellerLocation: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 3,
  },
  callCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.headline,
    fontSize: 16,
  },
  callTextBtn: {
    alignItems: 'center',
    gap: space[1],
    minHeight: 44,
    paddingHorizontal: space[2],
  },
  callTextLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 15,
  },
  sellerPrimaryCta: {
    marginTop: space[5],
    minHeight: 56,
  },
  sellerSecondaryCta: {
    marginTop: space[3],
    minHeight: 52,
  },
  auctionRows: {
    gap: space[3],
  },
  auctionRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  auctionValue: {
    fontFamily: fonts.headline,
    fontSize: 15,
    flexShrink: 1,
    textAlign: 'right',
  },
  bidSheetBody: {
    gap: space[2],
    paddingBottom: space[4],
  },
  historyRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.xl,
    marginBottom: space[2],
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
  },
  sellerSheetScroll: {
    maxHeight: 480,
  },
  offerCard: {
    marginTop: space[4],
    borderRadius: radii['2xl'],
    padding: space[4],
  },
  offerAmount: {
    fontFamily: fonts.display,
    fontSize: 28,
    marginBottom: space[3],
  },
  offerMetaRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  offerHeadline: {
    fontFamily: fonts.headline,
    fontSize: 15,
    marginBottom: space[1],
  },
  rejectionBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
    marginBottom: space[3],
  },
  rejectionBadgeText: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  rejectionTitle: {
    fontFamily: fonts.headline,
    fontSize: 18,
    marginBottom: space[3],
  },
  rejectionReason: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space[2],
  },
  insightsGrid: {
    flexWrap: 'wrap',
    gap: space[2],
  },
  insightTile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radii.xl,
    padding: space[3],
  },
  insightValue: {
    fontFamily: fonts.headline,
    fontSize: 18,
  },
  insightValueRow: {
    alignItems: 'center',
    minHeight: 22,
    gap: space[1],
  },
  insightValueFlex: {
    flex: 1,
    flexShrink: 1,
  },
  insightStatusValue: {
    minHeight: 22,
    justifyContent: 'center',
  },
  insightStatusBadge: {
    maxWidth: '100%',
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  insightStatusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  insightLabel: {
    fontFamily: fonts.label,
    fontSize: 12,
    marginTop: 2,
  },
  offerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 28, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  offerSheet: {
    borderTopLeftRadius: radii['2xl'] + 8,
    borderTopRightRadius: radii['2xl'] + 8,
    paddingHorizontal: space[5],
    paddingBottom: space[8],
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  offerTitle: {
    fontFamily: fonts.headline,
    fontSize: 22,
  },
  offerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space[1],
  },
  offerInput: {
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontFamily: fonts.display,
    fontSize: 28,
    marginTop: space[4],
    minHeight: 64,
  },
  offerActions: {
    gap: space[3],
    marginTop: space[5],
  },
  offerActionBtn: { flex: 1 },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageScroll: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  modalImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomScrollView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  zoomScrollViewContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: '#ffffff',
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
  bidComposer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  bidComposerMin: {
    fontFamily: fonts.label,
    fontSize: 13,
  },
  bidComposerMax: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  bidAmountField: {
    minHeight: 56,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    paddingHorizontal: space[4],
    alignItems: 'center',
  },
  bidAmountInput: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 20,
    paddingVertical: space[3],
  },
  bidAmountSuffix: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
  bidAmountError: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  placeBidCta: {
    minHeight: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBidCtaRow: {
    alignItems: 'center',
    gap: space[1],
  },
  placeBidCtaText: {
    fontFamily: fonts.labelBold,
    fontSize: 17,
  },
  primaryButtonDisabled: { opacity: 0.6 },
});
