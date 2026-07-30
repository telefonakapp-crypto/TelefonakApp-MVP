import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient, { resolveMediaUrl } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import FavoriteButton from '../components/FavoriteButton';

const PAGE_SIZE = 20;

export default function SavedListingsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const { loadFavorites } = useFavorites();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset) => {
    const response = await apiClient.get('/favorites', {
      params: { limit: PAGE_SIZE, offset },
    });
    return response.data.listings || [];
  }, []);

  const loadFirstPage = useCallback(async () => {
    try {
      const rows = await fetchPage(0);
      setListings(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching saved listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;

    setLoadingMore(true);
    try {
      const rows = await fetchPage(listings.length);
      setListings((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...rows.filter((item) => !seen.has(item.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more saved listings:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, listings.length, loading, loadingMore]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites({ force: true });
      loadFirstPage();
    }, [loadFavorites, loadFirstPage])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites({ force: true });
    loadFirstPage();
  };

  // Drop the card as soon as the user unsaves it from this screen.
  const handleToggled = (listingId, nextFavorite) => {
    if (!nextFavorite) {
      setListings((prev) => prev.filter((item) => item.id !== listingId));
    }
  };

  const conditionLabel = (conditionName) => {
    const key = conditionName?.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    const map = {
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
    return map[key] || conditionName || '';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => navigation.navigate('ListingDetails', { listingId: item.id })}
    >
      <View style={styles.cardImageContainer}>
        {item.thumbnail_image ? (
          <Image source={{ uri: resolveMediaUrl(item.thumbnail_image) }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.borderLight }]} />
        )}
        <FavoriteButton
          listingId={item.id}
          onToggled={(nextFavorite) => handleToggled(item.id, nextFavorite)}
        />
        <View
          style={[
            styles.conditionBadge,
            { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)' },
          ]}
        >
          <Text style={[styles.conditionText, { color: isDarkMode ? '#09090b' : '#ffffff' }]}>
            {conditionLabel(item.condition_name)}
          </Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.brand_name} {item.model_name}
        </Text>
        <Text style={[styles.cardPrice, { color: colors.primary }]}>{item.price} JOD</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('savedListings.title')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
                {t('savedListings.emptyTitle')}
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}
              >
                {t('savedListings.emptySubtitle')}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
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
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  card: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardImageContainer: {
    height: 128,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  conditionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
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
  footerLoader: {
    paddingVertical: 16,
  },
});
