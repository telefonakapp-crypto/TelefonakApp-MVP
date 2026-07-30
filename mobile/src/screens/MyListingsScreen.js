import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { getApiErrorMessage, logApiError } from '../utils/apiError';

import { API_BASE_URL, resolveMediaUrl } from '../utils/api';

// Mirrors TERMINAL_LISTING_STATUSES on the backend: these listings are history
// and carry no actions.
const TERMINAL_STATUSES = ['sold', 'deleted'];

export default function MyListingsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // /listings/user/my is always the caller's listings — owner actions are always allowed.
  const isListingOwner = () => true;

  const fetchListings = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/listings/user/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setListings(response.data.listings || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      Alert.alert('Error', 'Failed to load listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchListings();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'declined':
        return '#ef4444';
      case 'sold':
        return '#6b7280';
      case 'hidden':
        return '#8b5cf6';
      case 'deleted':
        return '#a1a1aa';
      default:
        return '#71717a';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return t('myListings.approved');
      case 'pending':
        return t('common.pending');
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
      t('myListings.markAsSoldConfirm') || 'Are you sure you want to mark this listing as sold? It will be hidden from the marketplace.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myListings.markAsSold'),
          style: 'default',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.put(`${API_BASE_URL}/listings/${listingId}/mark-sold`, {}, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              Alert.alert(t('common.success'), t('myListings.markedAsSoldSuccess'));
              fetchListings();
            } catch (error) {
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
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.patch(`${API_BASE_URL}/listings/${listingId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = response.data.listing;
      setListings((prev) => prev.map((item) => (item.id === listingId ? { ...item, ...updated } : item)));
      Alert.alert(
        t('common.success'),
        action === 'hide' ? t('myListings.hiddenSuccess') : t('myListings.unhiddenSuccess')
      );
    } catch (error) {
      logApiError(`MyListingsScreen.${action}`, error);
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('myListings.visibilityFailed'))
      );
      fetchListings();
    }
  };

  const handleHideListing = (listingId) => {
    Alert.alert(
      t('myListings.hideListing'),
      t('myListings.hideListingConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myListings.hide'),
          style: 'default',
          onPress: () => setListingVisibility(listingId, 'hide'),
        },
      ]
    );
  };

  const handleDeleteListing = (listingId) => {
    Alert.alert(
      t('myListings.deleteListing') || 'Delete Listing',
      t('myListings.deleteListingConfirm') || 'Are you sure you want to delete this listing?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.delete(`${API_BASE_URL}/listings/${listingId}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              Alert.alert(t('common.success'), t('myListings.deletedSuccess'));
              // Refetch so the card moves into the Deleted Listings section.
              fetchListings();
            } catch (error) {
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Sold and deleted listings are history, so they sit in their own sections
  // below the active ones. This becomes the Active / History tabs in the UI phase.
  const activeListings = listings.filter((listing) => !TERMINAL_STATUSES.includes(listing.status));
  const soldListings = listings.filter((listing) => listing.status === 'sold');
  const deletedListings = listings.filter((listing) => listing.status === 'deleted');
  const orderedListings = [...activeListings, ...soldListings, ...deletedListings];

  // Index of the first card in each history section, so one map can render
  // all three groups through the same listing card.
  const sectionTitles = new Map();
  if (soldListings.length > 0) {
    sectionTitles.set(activeListings.length, t('myListings.soldListings'));
  }
  if (deletedListings.length > 0) {
    sectionTitles.set(activeListings.length + soldListings.length, t('myListings.deletedListings'));
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
          {t('myListings.myListings')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {listings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('myListings.noListings')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('myListings.createFirstListing')}</Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('CreateListing')}
            >
              <Text style={[styles.createButtonText, getTextAlign(isRTL, 'center')]}>{t('myListings.createListing')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orderedListings.map((listing, index) => {
            // History cards carry no action row, so the whole card opens the
            // listing instead — deleted listings stay readable to their owner.
            const isHistory = TERMINAL_STATUSES.includes(listing.status);
            const CardWrapper = isHistory ? TouchableOpacity : View;
            const sectionTitle = sectionTitles.get(index);
            const sectionHeader = sectionTitle ? (
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
              >
                {sectionTitle}
              </Text>
            ) : null;
            const cardProps = isHistory
              ? { 
                  onPress: () => navigation.navigate('ListingDetails', { listingId: listing.id }),
                  activeOpacity: 0.8 
                }
              : {};
            
            return (
              <React.Fragment key={listing.id}>
              {sectionHeader}
              <CardWrapper 
                style={[
                  styles.listingCard, 
                  { backgroundColor: colors.surface },
                  isHistory && styles.soldListingCard
                ]}
                {...cardProps}
              >
                {listing.status === 'sold' && (
                  <View style={styles.soldOverlay}>
                    <View style={[styles.soldBadge, getFlexDirection(isRTL, 'row')]}>
                      <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.soldBadgeText, getTextAlign(isRTL, 'center')]}>{t('myListings.soldOut')}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.listingHeader}>
                <View style={styles.listingInfo}>
                  {listing.thumbnail_image ? (
                    <Image
                      source={{ uri: resolveMediaUrl(listing.thumbnail_image) }}
                      style={[styles.thumbnail, isHistory && styles.soldThumbnail, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}
                    />
                  ) : (
                    <View style={[
                      styles.thumbnailPlaceholder, 
                      { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 },
                      isHistory && styles.soldThumbnail
                    ]}>
                      <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={[styles.listingDetails, { marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
                    <Text style={[
                      styles.listingTitle, 
                      { color: colors.text },
                      isHistory && styles.soldText,
                      getTextAlign(isRTL, 'auto')
                    ]}>
                      {listing.brand_name} {listing.model_name}
                    </Text>
                    <Text style={[
                      styles.listingPrice, 
                      { color: colors.primary },
                      isHistory && styles.soldText,
                      getTextAlign(isRTL, 'auto')
                    ]}>
                      {listing.price} JOD
                    </Text>
                    <View style={[styles.listingMeta, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[
                        styles.listingMetaText, 
                        { color: colors.textSecondary },
                        isHistory && styles.soldText,
                        getTextAlign(isRTL, 'auto')
                      ]}>
                        {listing.capacity_gb} GB • {listing.color_name}
                      </Text>
                    </View>
                    {/* Sellers see view counts for their own listings only */}
                    {isListingOwner(listing) && listing.views !== undefined && listing.views !== null && (
                      <View style={[styles.listingMeta, getFlexDirection(isRTL, 'row')]}>
                        <Ionicons
                          name="eye-outline"
                          size={14}
                          color={colors.textSecondary}
                          style={{ marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0 }}
                        />
                        <Text style={[
                          styles.listingMetaText,
                          { color: colors.textSecondary },
                          isHistory && styles.soldText,
                          getTextAlign(isRTL, 'auto')
                        ]}>
                          {listing.views} {t('myListings.views')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(listing.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(listing.status) }]}>
                    {getStatusText(listing.status)}
                  </Text>
                </View>
              </View>

              {/* Sold and deleted listings are read-only history: no actions at all */}
              {!isHistory && (
                <View style={[styles.listingActions, { borderTopColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => navigation.navigate('ListingDetails', { listingId: listing.id })}
                  >
                    <Ionicons name="eye-outline" size={20} color={colors.primary} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('myListings.view')}</Text>
                  </TouchableOpacity>
                  {(listing.status === 'pending' || listing.status === 'approved' || listing.status === 'declined') && isListingOwner(listing) && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => navigation.navigate('EditListing', { listingId: listing.id })}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.warning} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, { color: colors.warning }, getTextAlign(isRTL, 'auto')]}>{t('myListings.edit')}</Text>
                    </TouchableOpacity>
                  )}
                  {listing.status === 'approved' && isListingOwner(listing) && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.soldButton, { backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5' }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => handleMarkAsSold(listing.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, styles.soldButtonText, { color: colors.success }, getTextAlign(isRTL, 'auto')]}>{t('myListings.markAsSold')}</Text>
                    </TouchableOpacity>
                  )}
                  {listing.status === 'approved' && isListingOwner(listing) && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => handleHideListing(listing.id)}
                    >
                      <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('myListings.hide')}</Text>
                    </TouchableOpacity>
                  )}
                  {listing.status === 'hidden' && isListingOwner(listing) && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => setListingVisibility(listing.id, 'unhide')}
                    >
                      <Ionicons name="eye-outline" size={20} color={colors.primary} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('myListings.unhide')}</Text>
                    </TouchableOpacity>
                  )}
                  {/* Deleting is owner-only, so admins browsing all listings don't see it */}
                  {isListingOwner(listing) && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => handleDeleteListing(listing.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>{t('myListings.delete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </CardWrapper>
              </React.Fragment>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listingInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingDetails: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listingMetaText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButton: {},
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButtonText: {},
  soldButton: {},
  soldButtonText: {},
  soldListingCard: {
    opacity: 0.7,
    position: 'relative',
  },
  soldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  soldBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  soldThumbnail: {
    opacity: 0.5,
  },
  soldText: {
    opacity: 0.6,
  },
});

