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
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';

export default function MyListingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const { isAdmin: routeIsAdmin } = route.params || {};
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchAdminStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setIsAdmin(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setIsAdmin(response.data.user?.is_admin === true);
      setCurrentUserId(response.data.user?.id);
    } catch (error) {
      console.error('Error fetching admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchListings = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Check if user is admin (use route param or fetch)
      const adminStatus = routeIsAdmin !== undefined ? routeIsAdmin : isAdmin;
      
      let response;
      if (adminStatus) {
        // Admin: fetch all listings with all statuses
        response = await axios.get(`${API_BASE_URL}/admin/listings/all?status=all`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Regular user: fetch only their listings
        response = await axios.get(`${API_BASE_URL}/listings/user/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
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
    fetchAdminStatus();
  }, []);

  useEffect(() => {
    fetchListings();
  }, [isAdmin, routeIsAdmin]);

  useFocusEffect(
    React.useCallback(() => {
      fetchAdminStatus();
      fetchListings();
    }, [isAdmin, routeIsAdmin])
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
      default:
        return '#71717a';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return t('myListings.active');
      case 'pending':
        return t('common.pending');
      case 'declined':
        return t('common.declined');
      case 'sold':
        return t('myListings.sold');
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
              console.error('Error marking listing as sold:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to mark listing as sold'
              );
            }
          },
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
              Alert.alert('Success', 'Listing deleted successfully');
              fetchListings();
            } catch (error) {
              console.error('Error deleting listing:', error);
              Alert.alert('Error', 'Failed to delete listing');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
          {(routeIsAdmin !== undefined ? routeIsAdmin : isAdmin) ? t('myListings.allListings') : t('myListings.myListings')}
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
          listings.map((listing) => {
            const CardWrapper = listing.status === 'sold' ? TouchableOpacity : View;
            const cardProps = listing.status === 'sold' 
              ? { 
                  onPress: () => navigation.navigate('ListingDetails', { listingId: listing.id }),
                  activeOpacity: 0.8 
                }
              : {};
            
            return (
              <CardWrapper 
                key={listing.id} 
                style={[
                  styles.listingCard, 
                  { backgroundColor: colors.surface },
                  listing.status === 'sold' && styles.soldListingCard
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
                      source={{ uri: listing.thumbnail_image }}
                      style={[styles.thumbnail, listing.status === 'sold' && styles.soldThumbnail, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}
                    />
                  ) : (
                    <View style={[
                      styles.thumbnailPlaceholder, 
                      { backgroundColor: colors.inputBackground, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 },
                      listing.status === 'sold' && styles.soldThumbnail
                    ]}>
                      <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={[styles.listingDetails, { marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
                    <Text style={[
                      styles.listingTitle, 
                      { color: colors.text },
                      listing.status === 'sold' && styles.soldText,
                      getTextAlign(isRTL, 'auto')
                    ]}>
                      {listing.brand_name} {listing.model_name}
                    </Text>
                    <Text style={[
                      styles.listingPrice, 
                      { color: colors.primary },
                      listing.status === 'sold' && styles.soldText,
                      getTextAlign(isRTL, 'auto')
                    ]}>
                      {listing.price} JOD
                    </Text>
                    <View style={[styles.listingMeta, getFlexDirection(isRTL, 'row')]}>
                      <Text style={[
                        styles.listingMetaText, 
                        { color: colors.textSecondary },
                        listing.status === 'sold' && styles.soldText,
                        getTextAlign(isRTL, 'auto')
                      ]}>
                        {listing.capacity_gb} GB • {listing.color_name}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(listing.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(listing.status) }]}>
                    {getStatusText(listing.status)}
                  </Text>
                </View>
              </View>

              {listing.status !== 'sold' && (
                <View style={[styles.listingActions, { borderTopColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => navigation.navigate('ListingDetails', { listingId: listing.id })}
                  >
                    <Ionicons name="eye-outline" size={20} color={colors.primary} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('myListings.view')}</Text>
                  </TouchableOpacity>
                  {listing.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => navigation.navigate('EditListing', { listingId: listing.id })}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.warning} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, { color: colors.warning }, getTextAlign(isRTL, 'auto')]}>{t('myListings.edit')}</Text>
                    </TouchableOpacity>
                  )}
                  {listing.status === 'approved' && listing.user_id === currentUserId && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.soldButton, { backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5' }, getFlexDirection(isRTL, 'row')]}
                      onPress={() => handleMarkAsSold(listing.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                      <Text style={[styles.actionButtonText, styles.soldButtonText, { color: colors.success }, getTextAlign(isRTL, 'auto')]}>{t('myListings.markAsSold')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => handleDeleteListing(listing.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                    <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>{t('myListings.delete')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </CardWrapper>
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
  },
  listingMetaText: {
    fontSize: 12,
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

