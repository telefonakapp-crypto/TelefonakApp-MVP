import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const PAGE_SIZE = 20;

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const { unreadCount, refreshUnreadCount, decrementUnreadCount, clearUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (offset) => {
    const response = await apiClient.get('/notifications', {
      params: { limit: PAGE_SIZE, offset },
    });
    return {
      rows: response.data.notifications || [],
      hasMore: Boolean(response.data.has_more),
    };
  }, []);

  const loadFirstPage = useCallback(async () => {
    try {
      const { rows, hasMore: more } = await fetchPage(0);
      setNotifications(rows);
      setHasMore(more);
    } catch (error) {
      console.error('Error fetching notifications:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { rows, hasMore: more } = await fetchPage(notifications.length);
      setNotifications((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...rows.filter((item) => !seen.has(item.id))];
      });
      setHasMore(more);
    } catch (error) {
      console.error('Error loading more notifications:', error.response?.data || error.message);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, notifications.length]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // Opening this screen refreshes the data but deliberately does not mark anything as read.
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFirstPage();
    refreshUnreadCount();
  };

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    decrementUnreadCount();

    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (error) {
      console.error('Error marking notification as read:', error.response?.data || error.message);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      refreshUnreadCount();
    }
  };

  const markAllAsRead = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    clearUnreadCount();

    try {
      await apiClient.patch('/notifications/read-all');
    } catch (error) {
      console.error('Error marking all notifications as read:', error.response?.data || error.message);
      setNotifications(previous);
      refreshUnreadCount();
    }
  };

  const handlePress = (item) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }

    // A hard-deleted listing leaves related_listing_id NULL, so there is nothing to open.
    if (item.related_listing_id) {
      navigation.navigate('ListingDetails', { listingId: item.related_listing_id });
    }
  };

  const renderIconForType = (type) => {
    switch (type) {
      case 'listing_approved':
        return <Ionicons name="checkmark-circle" size={24} color="#22c55e" />;
      case 'listing_rejected':
      // Rejections created before the type was renamed
      case 'listing_declined':
        return <Ionicons name="close-circle" size={24} color="#ef4444" />;
      case 'listing_sold':
        return <Ionicons name="pricetag" size={24} color="#f59e0b" />;
      case 'listing_hidden':
        return <Ionicons name="eye-off" size={24} color="#8b5cf6" />;
      case 'listing_active':
        return <Ionicons name="eye" size={24} color="#22c55e" />;
      case 'new_listing':
        return <Ionicons name="add-circle" size={24} color="#667eea" />;
      case 'offer_received':
        return <Ionicons name="pricetags" size={24} color="#667eea" />;
      case 'offer_accepted':
        return <Ionicons name="checkmark-done-circle" size={24} color="#10b981" />;
      case 'offer_rejected':
        return <Ionicons name="close-circle" size={24} color="#ef4444" />;
      default:
        return <Ionicons name="notifications-outline" size={24} color="#667eea" />;
    }
  };

  const renderItem = ({ item }) => {
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : '';
    const isRejected = item.type === 'listing_rejected' || item.type === 'listing_declined';
    const isApproved = item.type === 'listing_approved';
    const isNewListing = item.type === 'new_listing';

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          { backgroundColor: colors.surface },
          item.is_read && styles.notificationCardRead,
          !item.is_read && [styles.notificationCardUnread, {
            [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 3,
            [isRTL ? 'borderRightColor' : 'borderLeftColor']: colors.primary
          }],
          getFlexDirection(isRTL, 'row'),
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.notificationIcon, { marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
          {renderIconForType(item.type)}
        </View>
        <View style={styles.notificationContent}>
          <View style={[styles.notificationHeader, getFlexDirection(isRTL, 'row')]}>
            <Text style={[styles.notificationTitle, { color: colors.text, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }, getTextAlign(isRTL, 'auto')]}>{item.title}</Text>
            {!!createdAt && (
              <Text style={[styles.notificationDate, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{createdAt}</Text>
            )}
          </View>
          <Text
            style={[
              styles.notificationMessage,
              { color: colors.text },
              isRejected && styles.declinedText,
              isApproved && styles.approvedText,
              isNewListing && styles.newListingText,
              getTextAlign(isRTL, 'auto'),
            ]}
          >
            {item.message}
          </Text>
        </View>
        {!!item.related_listing_id && (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textSecondary}
            style={styles.notificationChevron}
          />
        )}
      </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('notifications.notifications')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('notifications.noNotificationsYet')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>
            {t('notifications.noNotificationsDesc')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
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
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationCardUnread: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  notificationCardRead: {
    opacity: 0.65,
  },
  notificationIcon: {
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationChevron: {
    alignSelf: 'center',
  },
  notificationHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  notificationDate: {
    fontSize: 11,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  declinedText: {
    color: '#b91c1c',
  },
  approvedText: {
    color: '#15803d',
  },
  newListingText: {
    color: '#667eea',
  },
  footerLoader: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
