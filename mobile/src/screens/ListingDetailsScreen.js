import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Linking } from 'react-native';
import apiClient from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { useFavorites } from '../context/FavoritesContext';
import FavoriteButton from '../components/FavoriteButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ListingDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL, language } = useLanguage();
  const { listingId } = route.params;
  const { loadFavorites } = useFavorites();
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const horizontalScrollViewRef = useRef(null);
  // One view per screen session, no matter how often this screen re-renders.
  const registeredViewFor = useRef(null);

  const fetchListingDetails = useCallback(async () => {
    try {
      // The response only carries `views` when the current user owns the listing.
      const response = await apiClient.get(`/listings/${listingId}`);
      setListing(response.data.listing);
      setImages(response.data.images || []);
    } catch (error) {
      console.error('Error fetching listing details:', error);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  const registerView = useCallback(async () => {
    if (registeredViewFor.current === listingId) return;
    registeredViewFor.current = listingId;

    try {
      const response = await apiClient.post(`/listings/${listingId}/view`);
      if (response.data?.views !== undefined) {
        setListing((prev) => (prev ? { ...prev, views: response.data.views } : prev));
      }
    } catch (error) {
      // A missed view must never affect the listing the user is reading.
      console.error('Error registering listing view:', error);
    }
  }, [listingId]);

  useEffect(() => {
    fetchListingDetails();
  }, [fetchListingDetails]);

  useEffect(() => {
    // Deliberately not awaited alongside the listing fetch — the screen renders first.
    registerView();
  }, [registerView]);

  useEffect(() => {
    // No-op when the shared favorite state is already in memory.
    loadFavorites();
  }, [loadFavorites]);

  const unhideListing = async () => {
    setUpdatingVisibility(true);
    try {
      const response = await apiClient.patch(`/listings/${listingId}/unhide`);
      // The response carries the refreshed row, so no second fetch is needed.
      setListing((prev) => (prev ? { ...prev, ...response.data.listing } : prev));
      Alert.alert(t('common.success'), t('myListings.unhiddenSuccess'));
    } catch (error) {
      console.error('Error unhiding listing:', error.response?.data || error.message);
      Alert.alert(t('common.error'), error.response?.data?.error || t('myListings.visibilityFailed'));
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const openOfferModal = () => {
    setOfferAmount('');
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
      closeOfferModal();
      Alert.alert(
        t('common.success'),
        response.data.updated ? t('offers.offerUpdated') : t('offers.offerSubmitted')
      );
    } catch (error) {
      console.error('Error submitting offer:', error.response?.data || error.message);
      Alert.alert(t('common.error'), error.response?.data?.error || t('offers.submitFailed'));
    } finally {
      setSubmittingOffer(false);
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

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('listingDetails.listingNotFound')}</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('listingDetails.listingDetails')}</Text>
        <FavoriteButton listingId={listingId} variant="plain" size={24} style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Image Gallery */}
        {images.length > 0 ? (
          <View style={styles.imageGalleryContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageGallery}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
            >
              {images.map((image, index) => (
                <TouchableOpacity
                  key={image.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedImageIndex(index);
                    setImageModalVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: image.image_url }}
                    style={styles.listingImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Image Indicators */}
            {images.length > 1 && (
              <View style={styles.imageIndicators}>
                {/* Dots Indicator */}
                <View style={styles.dotsContainer}>
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
                
                {/* Counter */}
                <View style={styles.imageCounterBadge}>
                  <Text style={styles.imageCounterBadgeText}>
                    {currentImageIndex + 1} / {images.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.borderLight }]}>
            <Ionicons name="image-outline" size={80} color={colors.textSecondary} />
          </View>
        )}

        {/* Listing Info */}
        <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
          {/* Only the owner can reach a hidden listing, so this is owner-only by definition */}
          {listing.status === 'hidden' && listing.is_owner && (
            <View style={[styles.hiddenNotice, { backgroundColor: colors.inputBackground }]}>
              <View style={[styles.hiddenNoticeHeader, getFlexDirection(isRTL, 'row')]}>
                <Ionicons
                  name="eye-off-outline"
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
                />
                <Text style={[styles.hiddenNoticeText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t('listingDetails.hiddenNotice')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.unhideButton, { backgroundColor: colors.primary }, updatingVisibility && styles.unhideButtonBusy]}
                onPress={unhideListing}
                disabled={updatingVisibility}
              >
                {updatingVisibility ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.unhideButtonText}>{t('myListings.unhideListing')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.priceSection}>
            <Text style={[styles.price, { color: colors.primary }]}>{listing.price} JOD</Text>
            <View style={[styles.conditionBadge, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)' }]}>
              <Text style={[styles.conditionText, { color: isDarkMode ? '#09090b' : '#ffffff' }, getTextAlign(isRTL, 'center')]}>
                {(() => {
                  const conditionKey = listing.condition_name?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                  const conditionMap = {
                    'new': t('conditions.new'),
                    'likenew': t('conditions.likeNew'),
                    'usedlikenew': t('conditions.usedlikenew'),
                    'usedgood': t('conditions.usedgood'),
                    'usedfair': t('conditions.usedfair'),
                    'excellent': t('conditions.excellent'),
                    'verygood': t('conditions.veryGood'),
                    'good': t('conditions.good'),
                    'fair': t('conditions.fair'),
                    'poor': t('conditions.poor'),
                    'used': t('conditions.used'),
                    'refurbished': t('conditions.refurbished'),
                  };
                  return conditionMap[conditionKey] || listing.condition_name || '';
                })()}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {listing.brand_name} {listing.model_name}
          </Text>

          {/* Present only when the API recognised the viewer as the owner */}
          {listing.views !== undefined && listing.views !== null && (
            <View style={[styles.viewsRow, getFlexDirection(isRTL, 'row')]}>
              <Ionicons
                name="eye-outline"
                size={16}
                color={colors.textSecondary}
                style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }}
              />
              <Text style={[styles.viewsText, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                {listing.views} {t('listingDetails.views')}
              </Text>
            </View>
          )}

          <View style={styles.specsSection}>
            <View style={[styles.specItem, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="albums-outline" size={20} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
              <Text style={[styles.specText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{listing.capacity_gb} GB</Text>
            </View>
            {listing.battery_percentage && (
              <View style={[styles.specItem, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="battery-charging" size={20} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                <Text style={[styles.specText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{listing.battery_percentage}%</Text>
              </View>
            )}
            <View style={[styles.specItem, getFlexDirection(isRTL, 'row')]}>
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: listing.color_hex || '#cccccc', borderColor: colors.inputBorder },
                  { marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }
                ]}
              />
              <Text style={[styles.specText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{listing.color_name}</Text>
            </View>
            {listing.sim_configuration_name && (
              <View style={[styles.specItem, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="cellular-outline" size={20} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                <Text style={[styles.specText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{listing.sim_configuration_name}</Text>
              </View>
            )}
            {listing.screen_size && (
              <View style={[styles.specItem, getFlexDirection(isRTL, 'row')]}>
                <Ionicons name="phone-portrait-outline" size={20} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                <Text style={[styles.specText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{listing.screen_size}"</Text>
              </View>
            )}
          </View>

          {((listing.description_en || listing.description_ar) || listing.description) && (
            <View style={[styles.descriptionSection, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.descriptionLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('listingDetails.description')}</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                {language === 'ar' && listing.description_ar 
                  ? listing.description_ar 
                  : listing.description_en || listing.description || t('listingDetails.noDescription')}
              </Text>
            </View>
          )}

        <View style={styles.sellerSection}>
          <Text style={[styles.sellerLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('listingDetails.seller')}</Text>

          <View style={[styles.sellerRow, getFlexDirection(isRTL, 'row')]}>
            {/* LEFT: Seller info */}
            <View style={styles.sellerInfo}>
              <Text style={[styles.sellerText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                {listing.first_name} {listing.last_name}
              </Text>

              {listing.location && (
                <View style={[styles.locationItem, getFlexDirection(isRTL, 'row')]}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} style={{ marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0 }} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{listing.location}</Text>
                </View>
              )}
            </View>

            {/* RIGHT: Phone */}
            {listing.phone_number && (
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: '#22c55e' }, getFlexDirection(isRTL, 'row')]}
                onPress={() => Linking.openURL(`tel:${listing.phone_number}`)}
              >
                <Ionicons name="call" size={18} color="#ffffff" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                <Text style={[styles.callText, getTextAlign(isRTL, 'auto')]}>{t('listingDetails.call')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Buyers only: the API tells us whether this user owns the listing */}
          {!listing.is_owner && listing.status === 'approved' && (
            <TouchableOpacity
              style={[styles.makeOfferButton, { backgroundColor: colors.primary }, getFlexDirection(isRTL, 'row')]}
              onPress={openOfferModal}
            >
              <Ionicons name="pricetag-outline" size={18} color="#ffffff" style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
              <Text style={styles.makeOfferText}>{t('offers.makeAnOffer')}</Text>
            </TouchableOpacity>
          )}
        </View>

        </View>
      </ScrollView>

      {/* Make an Offer */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeOfferModal}
      >
        <View style={styles.offerModalOverlay}>
          <View style={[styles.offerModalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.offerModalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('offers.makeAnOffer')}
            </Text>
            <Text style={[styles.offerModalSubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('offers.askingPriceIs')} {listing.price} JOD
            </Text>

            <TextInput
              style={[styles.offerInput, {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.text,
              }, getTextAlign(isRTL, 'auto')]}
              value={offerAmount}
              onChangeText={setOfferAmount}
              placeholder={t('offers.offerAmountPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              autoFocus
            />

            <View style={[styles.offerModalActions, getFlexDirection(isRTL, 'row')]}>
              <TouchableOpacity
                style={[styles.offerModalButton, { backgroundColor: colors.inputBackground }]}
                onPress={closeOfferModal}
                disabled={submittingOffer}
              >
                <Text style={[styles.offerModalButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerModalButton, { backgroundColor: colors.primary }, submittingOffer && styles.offerModalButtonBusy]}
                onPress={submitOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.offerModalButtonText, { color: '#ffffff' }]}>{t('offers.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
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
            scrollEnabled={true}
            scrollEventThrottle={16}
          >
            {images.map((image, index) => (
              <View key={image.id} style={styles.modalImageContainer}>
                <ScrollView
                  style={styles.zoomScrollView}
                  contentContainerStyle={styles.zoomScrollViewContent}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  bouncesZoom={true}
                  scrollEventThrottle={16}
                  onScrollBeginDrag={() => {
                    // Disable horizontal scroll when user starts interacting with zoom
                    if (horizontalScrollViewRef.current) {
                      horizontalScrollViewRef.current.setNativeProps({ scrollEnabled: false });
                    }
                  }}
                  onScrollEndDrag={() => {
                    // Re-enable horizontal scroll after a delay
                    setTimeout(() => {
                      if (horizontalScrollViewRef.current) {
                        horizontalScrollViewRef.current.setNativeProps({ scrollEnabled: true });
                      }
                    }, 100);
                  }}
                  onMomentumScrollEnd={() => {
                    // Re-enable horizontal scroll
                    if (horizontalScrollViewRef.current) {
                      horizontalScrollViewRef.current.setNativeProps({ scrollEnabled: true });
                    }
                  }}
                >
                  <Image
                    source={{ uri: image.image_url }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          {/* Image Counter */}
          {images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
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
    paddingBottom: 24,
  },
  imageGalleryContainer: {
    position: 'relative',
  },
  imageGallery: {
    height: 300,
  },
  listingImage: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#ffffff',
  },
  imageCounterBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  placeholderImage: {
    width: SCREEN_WIDTH,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  conditionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  viewsText: {
    fontSize: 14,
  },
  specsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 16,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  specText: {
    fontSize: 14,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  descriptionSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sellerSection: {
    paddingTop: 16,
  },
  sellerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sellerText: {
    fontSize: 16,
    marginBottom: 8,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  
  sellerInfo: {
    flex: 1,
  },
  
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  
  callText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  hiddenNotice: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  hiddenNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hiddenNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  unhideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  unhideButtonBusy: {
    opacity: 0.7,
  },
  unhideButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  makeOfferText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  offerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  offerModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  offerModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  offerModalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  offerInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  offerModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  offerModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  offerModalButtonBusy: {
    opacity: 0.7,
  },
  offerModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
  },
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
    fontSize: 14,
    fontWeight: '600',
  },
});

