import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import apiClient from '../utils/api';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import {
  markListingSold,
  setListingVisibility as requestListingVisibility,
  deleteListing,
  shareListing,
} from '../utils/listingOwnerActions';
import { listingOwnerCapabilities } from '../utils/listingOwnerCapabilities';
import {
  EmptyState,
  IconButton,
  BottomSheet,
  HorizontalCardSkeleton,
  OwnerActionRow,
  ownerActionListStyle,
} from '../components/ui';
import { MyListingCard } from '../components/MyListingCard';

// Mirrors TERMINAL_LISTING_STATUSES on the backend: these listings are history
// and carry no actions.
const TERMINAL_STATUSES = ['sold', 'deleted'];

export default function MyListingsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState('active'); // active | history
  const [menuListing, setMenuListing] = useState(null);

  // /listings/user/my is always the caller's listings — owner actions are always allowed.
  const isListingOwner = () => true;

  const fetchListings = async () => {
    try {
      const response = await apiClient.get('/listings/user/my');
      setListings(response.data.listings || []);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('MyListingsScreen.fetchListings', error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, 'Failed to load listings')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return t('myListings.approved');
      case 'pending':
        return t('myListings.pendingReview') || 'Pending Review';
      case 'resubmitted':
        return t('common.resubmitted');
      case 'updated':
        return t('common.updated');
      case 'declined':
        return t('common.declined');
      case 'sold':
        return t('myListings.sold');
      case 'hidden':
        return t('myListings.hidden');
      case 'deleted':
        return t('myListings.deleted');
      default:
        return status;
    }
  };

  const handleMarkAsSold = (listingId) => {
    Alert.alert(
      t('myListings.markAsSold'),
      t('myListings.markAsSoldConfirm') ||
        'Are you sure you want to mark this listing as sold? It will be hidden from the marketplace.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myListings.markAsSold'),
          style: 'default',
          onPress: async () => {
            try {
              await markListingSold(listingId);
              Alert.alert(t('common.success'), t('myListings.markedAsSoldSuccess'));
              fetchListings();
            } catch (error) {
              if (ignoreIfMaintenance(error)) return;
              logApiError('MyListingsScreen.markAsSold', error);
              Alert.alert(
                t('common.error'),
                getApiErrorMessage(error, 'Failed to mark listing as sold')
              );
            }
          },
        },
      ]
    );
  };

  // Hiding and unhiding are the same request in opposite directions; the list
  // row is patched from the response instead of refetching every listing.
  const setListingVisibility = async (listingId, action) => {
    try {
      const response = await requestListingVisibility(listingId, action);
      const updated = response.data.listing;
      setListings((prev) =>
        prev.map((item) => (item.id === listingId ? { ...item, ...updated } : item))
      );
      Alert.alert(
        t('common.success'),
        action === 'hide' ? t('myListings.hiddenSuccess') : t('myListings.unhiddenSuccess')
      );
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError(`MyListingsScreen.${action}`, error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('myListings.visibilityFailed'))
      );
      fetchListings();
    }
  };

  const handleHideListing = (listingId) => {
    Alert.alert(t('myListings.hideListing'), t('myListings.hideListingConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myListings.hide'),
        style: 'default',
        onPress: () => setListingVisibility(listingId, 'hide'),
      },
    ]);
  };

  const handleDeleteListing = (listingId) => {
    Alert.alert(
      t('myListings.deleteListing') || 'Delete Listing',
      t('myListings.deleteListingConfirm') ||
        'Are you sure you want to delete this listing?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListing(listingId);
              Alert.alert(t('common.success'), t('myListings.deletedSuccess'));
              // Refetch so the card moves into the Deleted Listings section.
              fetchListings();
            } catch (error) {
              if (ignoreIfMaintenance(error)) return;
              logApiError('MyListingsScreen.deleteListing', error);
              Alert.alert(
                t('common.error'),
                getApiErrorMessage(error, t('myListings.deleteFailed'))
              );
            }
          },
        },
      ]
    );
  };

  const handleShareListing = async (listing) => {
    if (!listing) return;
    try {
      await shareListing(listing, t);
    } catch (error) {
      if (error?.message === 'User did not share') return;
      Alert.alert(t('common.error'), t('listingDetails.shareFailed'));
    }
  };

  const closeMenu = () => setMenuListing(null);

  const runMenuAction = (action) => {
    const listing = menuListing;
    closeMenu();
    if (!listing) return;
    // Defer slightly so the sheet can dismiss before Alert/Share presents.
    setTimeout(() => action(listing), 220);
  };

  const getOverflowItems = (listing) => {
    if (!listing) return [];
    const caps = listingOwnerCapabilities(listing, { isOwner: true });
    if (!caps.canDelete) return [];
    const items = [];

    if (caps.canMarkSold) {
      items.push({
        key: 'sold',
        icon: 'pricetag-outline',
        label: t('myListings.markAsSold'),
        onPress: () => runMenuAction((l) => handleMarkAsSold(l.id)),
      });
    }
    if (caps.canHide) {
      items.push({
        key: 'hide',
        icon: 'eye-off-outline',
        label: t('myListings.hideListing'),
        onPress: () => runMenuAction((l) => handleHideListing(l.id)),
      });
    }

    if (caps.canUnhide) {
      items.push({
        key: 'unhide',
        icon: 'eye-outline',
        label: t('myListings.unhideListing'),
        onPress: () =>
          runMenuAction((l) => setListingVisibility(l.id, 'unhide')),
      });
    }

    items.push({
      key: 'delete',
      icon: 'trash-outline',
      label: t('myListings.deleteListing'),
      destructive: true,
      onPress: () => runMenuAction((l) => handleDeleteListing(l.id)),
    });

    items.push({
      key: 'share',
      icon: 'share-social-outline',
      label: t('listingDetails.shareListing'),
      onPress: () => runMenuAction((l) => handleShareListing(l)),
    });

    return items;
  };

  const activeListings = listings.filter(
    (listing) => !TERMINAL_STATUSES.includes(listing.status)
  );
  const soldListings = listings.filter((listing) => listing.status === 'sold');
  const deletedListings = listings.filter((listing) => listing.status === 'deleted');
  const historyListings = [...soldListings, ...deletedListings];
  const visibleListings = segment === 'active' ? activeListings : historyListings;

  const sectionTitles = new Map();
  if (segment === 'history') {
    if (soldListings.length > 0) {
      sectionTitles.set(0, t('myListings.soldListings'));
    }
    if (deletedListings.length > 0) {
      sectionTitles.set(soldListings.length, t('myListings.deletedListings'));
    }
  }

  if (loading) {
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
          >
            {t('myListings.myListings')}
          </Text>
          <IconButton
            name="add"
            color={colors.primary}
            onPress={() => navigation.navigate('CreateListing')}
          />
        </View>
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, index) => (
            <HorizontalCardSkeleton key={index} action />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const renderListingCard = (listing, index) => {
    const isHistory = TERMINAL_STATUSES.includes(listing.status);
    const isDeleted = listing.status === 'deleted';
    const sectionTitle = sectionTitles.get(index);
    const openListingDetails = () =>
      navigation.navigate('ListingDetails', { listingId: listing.id });

    const caps = listingOwnerCapabilities(listing, {
      isOwner: isListingOwner(listing),
    });
    const showEdit = caps.canEdit;
    const showUpdate = caps.canResubmit;
    const showOverflow = caps.canDelete;
    const declineReason =
      typeof listing.decline_reason === 'string' && listing.decline_reason.trim()
        ? listing.decline_reason.trim()
        : t('listingDetails.rejectedNoReason');

    const reviewMessage =
      !isHistory &&
      (listing.status === 'pending' ||
        listing.status === 'resubmitted' ||
        listing.status === 'updated')
        ? listing.status === 'resubmitted'
          ? t('myListings.resubmittedNote') ||
            'Your listing has been resubmitted and is under review again.'
          : listing.status === 'updated'
            ? t('myListings.updatedNote') ||
              'Your listing has been updated and is awaiting review.'
            : t('myListings.pendingNote') ||
              'Your listing is currently under review.'
        : null;

    return (
      <React.Fragment key={listing.id}>
        {sectionTitle ? (
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.textSecondary },
              getTextAlign(isRTL, 'auto'),
            ]}
          >
            {sectionTitle}
          </Text>
        ) : null}

        <MyListingCard
          listing={listing}
          isHistory={isHistory}
          isDeleted={isDeleted}
          showEdit={showEdit}
          showUpdate={showUpdate}
          showOverflow={showOverflow}
          statusLabel={getStatusText(listing.status)}
          declineReason={showUpdate ? declineReason : null}
          reviewMessage={reviewMessage}
          reviewFeedbackTitle={t('myListings.reviewFeedback') || 'Review feedback'}
          editLabel={
            showUpdate
              ? t('myListings.updateListing') || 'Update Listing'
              : t('myListings.edit')
          }
          moreLabel={t('common.more') || 'More'}
          onPress={openListingDetails}
          onEdit={() =>
            navigation.navigate('CreateListing', { listingId: listing.id })
          }
          onOpenMenu={() => setMenuListing(listing)}
        />
      </React.Fragment>
    );
  };

  const overflowItems = getOverflowItems(menuListing);

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
          {t('myListings.myListings')}
        </Text>
        <IconButton
          name="add"
          color={colors.primary}
          onPress={() => navigation.navigate('CreateListing')}
          accessibilityLabel={t('myListings.createListing')}
        />
      </View>

      {listings.length > 0 ? (
        <View
          style={[
            styles.segmentTrack,
            { backgroundColor: colors.surfaceContainerLow },
            getFlexDirection(isRTL, 'row'),
          ]}
        >
          {[
            {
              key: 'active',
              label: t('myListings.activeTab') || 'Active',
              count: activeListings.length,
            },
            {
              key: 'history',
              label: t('myListings.historyTab') || 'History',
              count: historyListings.length,
            },
          ].map((item) => {
            const selected = segment === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.segmentBtn,
                  selected && [
                    styles.segmentBtnActive,
                    ambientElevation,
                    { backgroundColor: colors.surface },
                  ],
                ]}
                onPress={() => setSegment(item.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: selected ? colors.text : colors.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.segmentCount,
                    {
                      backgroundColor: selected
                        ? 'rgba(25, 118, 210, 0.12)'
                        : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentCountText,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {item.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {listings.length === 0 ? (
          <EmptyState
            icon="phone-portrait-outline"
            title={t('myListings.noListings')}
            description={t('myListings.createFirstListing')}
            actionLabel={t('myListings.createListing')}
            onAction={() => navigation.navigate('CreateListing')}
          />
        ) : visibleListings.length === 0 ? (
          <EmptyState
            icon={segment === 'history' ? 'time-outline' : 'file-tray-outline'}
            title={
              segment === 'history'
                ? t('myListings.noHistory') || 'No history yet'
                : t('myListings.noActive') || 'No active listings'
            }
            description={
              segment === 'history'
                ? t('myListings.noHistoryHint') ||
                  'Sold and deleted listings will appear here.'
                : t('myListings.noActiveHint') ||
                  'Create a listing to start selling on Telefonak.'
            }
            actionLabel={
              segment === 'active' ? t('myListings.createListing') : undefined
            }
            onAction={
              segment === 'active'
                ? () => navigation.navigate('CreateListing')
                : undefined
            }
          />
        ) : (
          visibleListings.map((listing, index) => renderListingCard(listing, index))
        )}
      </ScrollView>

      <BottomSheet
        open={!!menuListing}
        onClose={closeMenu}
        title={t('myListings.manageListing') || 'Manage listing'}
        maxHeight="55%"
      >
        <View style={[ownerActionListStyle, styles.menuList]}>
          {overflowItems.map((item) => (
            <OwnerActionRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              onPress={item.onPress}
              variant={item.destructive ? 'danger' : 'neutral'}
            />
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonList: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    gap: space[3],
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
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  segmentTrack: {
    marginHorizontal: space[5],
    marginTop: space[2],
    marginBottom: space[3],
    borderRadius: radii.full,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
  },
  segmentBtnActive: {},
  segmentLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
  segmentCount: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentCountText: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
  },
  content: { flex: 1 },
  contentContainer: {
    paddingHorizontal: space[5],
    paddingBottom: space[10],
    gap: space[3],
  },
  sectionLabel: {
    fontFamily: fonts.label,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space[2],
    marginBottom: -space[1],
  },
  menuList: {
    paddingBottom: space[4],
  },
});
