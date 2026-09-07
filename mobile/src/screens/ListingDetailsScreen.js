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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { listingOwnerCapabilities } from '../utils/listingOwnerCapabilities';
import OfferStatusBadge from '../components/OfferStatusBadge';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { showToast } from '../utils/toast';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import {
  Button,
  Card,
  DetailScreenSkeleton,
  IconButton,
  EmptyState,
  OwnerActionRow,
  ownerActionListStyle,
} from '../components/ui';
import { isSmartwatchListing } from '../utils/listingCatalogForm';
import { formatListingLocation } from '../utils/marketplaceFilters';
import { conditionKey, localizeConditionName } from '../utils/listingCondition';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GALLERY_HEIGHT = Math.min(SCREEN_WIDTH * 0.95, 400);

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
  const { colors } = useTheme();
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
  const horizontalScrollViewRef = useRef(null);
  const registeredViewFor = useRef(null);

  const fetchListingDetails = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await apiClient.get(`/listings/${listingId}`);
      setListing(response.data.listing);
      setImages(response.data.images || []);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('ListingDetailsScreen.fetchListingDetails', error);
      setLoadError(error?.response?.status !== 404);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

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
        <Text
          style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}
          numberOfLines={1}
        >
          {t('listingDetails.listingDetails')}
        </Text>
        {isOwner ? (
          <IconButton
            name="share-outline"
            onPress={handleShareListing}
            accessibilityLabel={t('listingDetails.shareListing')}
          />
        ) : (
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
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed gallery */}
        {images.length > 0 ? (
          <View style={styles.galleryWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {images.length > 1 ? (
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
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.galleryPlaceholder,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <Ionicons name="image-outline" size={64} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
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

          {/* Hero: Price → Title → Condition → Location */}
          <View style={styles.heroBlock}>
            <Text style={[styles.price, { color: colors.primary }]}>
              {listing.price}
              <Text style={[styles.currency, { color: colors.primary }]}> JOD</Text>
            </Text>

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
            </View>

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
                {[
                  { value: listing.views ?? '—', label: t('listingDetails.viewsLabel') },
                  {
                    value: listing.favorites_count ?? '—',
                    label: t('listingDetails.favoritesLabel'),
                  },
                  {
                    value: listing.offers_count ?? '—',
                    label: t('listingDetails.offersLabel'),
                  },
                  {
                    value: getStatusLabel(listing.status),
                    label: t('listingDetails.statusLabel'),
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      styles.insightTile,
                      { backgroundColor: colors.surfaceContainerLow },
                    ]}
                  >
                    <Text
                      style={[styles.insightValue, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.value}
                    </Text>
                    <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
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

          {/* Seller / Your listing */}
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
                <Ionicons name="person" size={22} color={colors.primary} />
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
              ) : null}
            </View>

            {!isOwner && listing.has_my_offer ? (
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

            {!isOwner && !listing.has_my_offer && listing.status === 'approved' ? (
              <Button
                label={t('offers.makeAnOffer')}
                onPress={() => openOfferModal('')}
                style={styles.sellerPrimaryCta}
              />
            ) : null}

            {!isOwner ? (
              <Button
                label={t('listingDetails.shareListing')}
                variant="outline"
                onPress={handleShareListing}
                style={styles.sellerSecondaryCta}
              />
            ) : null}
          </Card>

          {/* Owner management */}
          {isOwner ? (
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
                  disabled={ownerActionBusy}
                />

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
  headerTitle: {
    fontFamily: fonts.headline,
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  contentContainer: { paddingBottom: space[10] },
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
  sellerPrimaryCta: {
    marginTop: space[5],
    minHeight: 56,
  },
  sellerSecondaryCta: {
    marginTop: space[3],
    minHeight: 52,
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
});
