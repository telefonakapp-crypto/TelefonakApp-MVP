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
  TextInput,
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

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending'); // pending, approved, declined, deleted, all
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchListings = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      let endpoint;
      
      if (filter === 'pending') {
        endpoint = `${API_BASE_URL}/admin/listings/pending`;
      } else {
        // For approved, declined, deleted, or all - use the all endpoint with status filter
        endpoint = `${API_BASE_URL}/admin/listings/all?status=${filter}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setListings(response.data.listings || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      if (error.response?.status === 403) {
        Alert.alert(t('admin.accessDenied'), t('admin.noAdminPrivileges'));
        navigation.goBack();
      } else {
        Alert.alert(t('common.error'), t('admin.failedToLoad'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/admin/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchUnreadCount();
  }, [filter]);

  useFocusEffect(
    React.useCallback(() => {
      fetchListings();
      fetchUnreadCount();
    }, [filter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleApprove = async (listingId) => {
    Alert.alert(
      t('admin.approveListing'),
      t('admin.approveConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.approve'),
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.post(
                `${API_BASE_URL}/admin/listings/${listingId}/approve`,
                {},
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              Alert.alert(t('common.success'), t('admin.listingApproved'));
              fetchListings();
              fetchUnreadCount();
            } catch (error) {
              console.error('Error approving listing:', error);
              Alert.alert(t('common.error'), t('admin.approveFailed'));
            }
          },
        },
      ]
    );
  };

  const handleDecline = (listing) => {
    setSelectedListing(listing);
    setShowDeclineModal(true);
  };

  const confirmDecline = async () => {
    if (!selectedListing) return;

    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(
        `${API_BASE_URL}/admin/listings/${selectedListing.id}/decline`,
        { reason: declineReason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Alert.alert(t('common.success'), t('admin.listingDeclined'));
      setShowDeclineModal(false);
      setDeclineReason('');
      setSelectedListing(null);
      fetchListings();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error declining listing:', error);
      Alert.alert(t('common.error'), t('admin.declineFailed'));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'declined':
        return '#ef4444';
      case 'deleted':
        return '#6b7280';
      case 'sold':
        return '#6366f1';
      default:
        return '#71717a';
    }
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
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('admin.adminDashboard')}</Text>
        <View style={[styles.headerRight, getFlexDirection(isRTL, 'row')]}>
          <TouchableOpacity 
            style={styles.adsButton}
            onPress={() => navigation.navigate('AdminAds')}
          >
            <Ionicons name="image-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isRTL ? { flexDirection: 'row-reverse' } : {}}
        >
          {['pending', 'approved', 'declined', 'deleted', 'sold', 'all'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                { backgroundColor: filter === status ? colors.primary : colors.inputBackground },
              ]}
              onPress={() => setFilter(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: filter === status ? '#ffffff' : colors.textSecondary },
                  getTextAlign(isRTL, 'center'),
                ]}
              >
                {t(`admin.${status}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {listings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
              {t('admin.noListings').replace('{status}', t(`admin.${filter}`))}
            </Text>
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
                    <View style={styles.soldBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                      <Text style={styles.soldBadgeText}>{t('admin.soldOut')}</Text>
                    </View>
                  </View>
                )}
                <View style={[styles.listingHeader, getFlexDirection(isRTL, 'row')]}>
                <View style={[styles.listingInfo, getFlexDirection(isRTL, 'row')]}>
                  {listing.thumbnail_image ? (
                    <Image
                      source={{ uri: listing.thumbnail_image }}
                      style={[
                        styles.thumbnail, 
                        { backgroundColor: colors.inputBackground },
                        listing.status === 'sold' && styles.soldThumbnail
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[
                      styles.thumbnailPlaceholder, 
                      { backgroundColor: colors.inputBackground },
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
                      getTextAlign(isRTL, 'auto'),
                    ]}>
                      {listing.brand_name} {listing.model_name}
                    </Text>
                    <Text style={[
                      styles.listingPrice, 
                      { color: colors.primary },
                      listing.status === 'sold' && styles.soldText,
                      getTextAlign(isRTL, 'auto'),
                    ]}>{listing.price} JOD</Text>
                    <Text style={[
                      styles.listingSeller, 
                      { color: colors.textSecondary },
                      listing.status === 'sold' && styles.soldText,
                      getTextAlign(isRTL, 'auto'),
                    ]}>
                      {t('admin.seller')}: {listing.first_name} {listing.last_name}
                    </Text>
                    <Text style={[
                      styles.listingPhone, 
                      { color: colors.textSecondary },
                      listing.status === 'sold' && styles.soldText,
                      getTextAlign(isRTL, 'auto'),
                    ]}>{listing.phone_number}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(listing.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(listing.status) }, getTextAlign(isRTL, 'center')]}>
                    {t(`admin.${listing.status}`)}
                  </Text>
                </View>
              </View>

              {listing.status === 'pending' && (
                <View style={[styles.actionButtons, getFlexDirection(isRTL, 'row')]}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5' }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => handleApprove(listing.id)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                    <Text style={[styles.actionButtonText, { color: colors.success }, getTextAlign(isRTL, 'auto')]}>{t('admin.approve')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }, getFlexDirection(isRTL, 'row')]}
                    onPress={() => handleDecline(listing)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                    <Text style={[styles.actionButtonText, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>{t('admin.decline')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {listing.status !== 'sold' && (
                <TouchableOpacity
                  style={[styles.viewButton, { borderTopColor: colors.borderLight }]}
                  onPress={() => navigation.navigate('ListingDetails', { listingId: listing.id })}
                >
                  <Text style={[styles.viewButtonText, { color: colors.primary }, getTextAlign(isRTL, 'center')]}>{t('admin.viewDetails')}</Text>
                </TouchableOpacity>
              )}
            </CardWrapper>
            );
          })
        )}
      </ScrollView>

      {showDeclineModal && (
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.declineListing')}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('admin.declineReason')}</Text>
            <TextInput
              style={[
                styles.reasonInput,
                { 
                  backgroundColor: colors.inputBackground, 
                  borderColor: colors.inputBorder, 
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                }
              ]}
              placeholder={t('admin.enterReason')}
              placeholderTextColor={colors.textMuted}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              numberOfLines={4}
            />
            <View style={[styles.modalButtons, getFlexDirection(isRTL, 'row')]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                  setSelectedListing(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.error }]}
                onPress={confirmDecline}
              >
                <Text style={[styles.confirmButtonText, getTextAlign(isRTL, 'center')]}>{t('admin.decline')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 16,
    marginTop: 16,
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
  listingSeller: {
    fontSize: 12,
    marginBottom: 2,
  },
  listingPhone: {
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

