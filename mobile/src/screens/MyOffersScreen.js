import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import OfferStatusBadge from '../components/OfferStatusBadge';

export default function MyOffersScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      const response = await apiClient.get('/offers/sent');
      setOffers(response.data.offers || []);
    } catch (error) {
      console.error('Error fetching sent offers:', error.response?.data || error.message);
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

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* A sold or hidden listing is no longer readable by the buyer, so the
          offer stays as history but the row does not lead to a dead end. */}
      <TouchableOpacity
        style={[styles.cardTop, getFlexDirection(isRTL, 'row')]}
        onPress={() => navigation.navigate('ListingDetails', { listingId: item.listing_id })}
        disabled={item.listing_status !== 'approved'}
        activeOpacity={0.8}
      >
        {item.thumbnail_image ? (
          <Image source={{ uri: resolveMediaUrl(item.thumbnail_image) }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: colors.inputBackground }]}>
            <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
          </View>
        )}

        <View style={[styles.info, { marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
          <Text style={[styles.listingTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]} numberOfLines={1}>
            {item.brand_name} {item.model_name}
          </Text>
          <Text style={[styles.offerPrice, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>
            {item.offered_price} JOD
            <Text style={[styles.askingPrice, { color: colors.textSecondary }]}>
              {'  '}({t('offers.asking')} {item.listing_price} JOD)
            </Text>
          </Text>
          <View style={[styles.metaRow, getFlexDirection(isRTL, 'row')]}>
            <OfferStatusBadge status={item.status} />
            <Text style={[styles.date, { color: colors.textSecondary, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* The API only returns the seller's number for accepted offers */}
      {item.status === 'accepted' && !!item.seller_phone_number && (
        <View style={[styles.actions, { borderTopColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
          <TouchableOpacity
            style={[styles.callButton, getFlexDirection(isRTL, 'row')]}
            onPress={() => Linking.openURL(`tel:${item.seller_phone_number}`)}
          >
            <Ionicons name="call" size={18} color="#ffffff" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
            <Text style={styles.callText}>{t('offers.callSeller')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('offers.myOffers')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetag-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
                {t('offers.noSentOffers')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
                {t('offers.noSentOffersDesc')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    padding: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  askingPrice: {
    fontSize: 12,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  date: {
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 8,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  callText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
});
