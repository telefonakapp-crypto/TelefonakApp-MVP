import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../utils/api';
import { logApiError } from '../utils/apiError';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import {
  formatNotificationTime,
  localizeNotification,
} from '../utils/notificationDisplay';
import { resolveNotificationDestination } from '../utils/notificationNavigation';

const PAGE_SIZE = 20;

function getDateLocale(language) {
  return language === 'ar' ? 'ar' : undefined;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDaySectionTitle(date, locale, t) {
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(date);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);

  if (diffDays === 0) return t('notifications.today');
  if (diffDays === 1) return t('notifications.yesterday');

  const options = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString(locale, options);
}

function groupNotificationsByLocalDay(items, locale, t) {
  const sections = [];

  items.forEach((item) => {
    const parsed = item.created_at ? new Date(item.created_at) : null;
    const valid = parsed instanceof Date && !Number.isNaN(parsed.getTime());
    const dayKey = valid ? localDayKey(parsed) : 'unknown';
    const previous = sections[sections.length - 1];

    if (previous && previous.dayKey === dayKey) {
      previous.data.push(item);
      return;
    }

    sections.push({
      key: `${dayKey}-${sections.length}`,
      dayKey,
      title: valid ? formatDaySectionTitle(parsed, locale, t) : '',
      data: [item],
    });
  });

  return sections;
}

function getNotificationTypeVisual(type) {
  switch (type) {
    case 'listing_approved':
      return { name: 'checkmark-circle', color: '#22c55e' };
    case 'listing_rejected':
    // Rejections created before the type was renamed
    case 'listing_declined':
      return { name: 'close-circle', color: '#ef4444' };
    case 'listing_sold':
      return { name: 'pricetag', color: '#f59e0b' };
    case 'listing_hidden':
      return { name: 'eye-off', color: '#8b5cf6' };
    case 'listing_active':
      return { name: 'eye', color: '#22c55e' };
    case 'new_listing':
      return { name: 'add-circle', color: '#667eea' };
    case 'offer_received':
      return { name: 'pricetags', color: '#667eea' };
    case 'offer_accepted':
      return { name: 'checkmark-done-circle', color: '#10b981' };
    case 'offer_rejected':
      return { name: 'close-circle', color: '#ef4444' };
    default:
      return { name: 'notifications-outline', color: '#667eea' };
  }
}

function NotificationCard({ item, title, message, timeLabel, colors, isRTL, onPress }) {
  const isRead = Boolean(item.is_read);
  const visual = getNotificationTypeVisual(item.type);
  const titleColor = isRead ? colors.textMuted : colors.text;
  const messageColor = isRead ? colors.textMuted : colors.textSecondary;

  return (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        getFlexDirection(isRTL, 'row'),
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIconWrap}>
        <View
          style={[
            styles.notificationIconWell,
            {
              backgroundColor: `${visual.color}14`,
              opacity: isRead ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name={visual.name} size={16} color={visual.color} />
        </View>
        {!isRead ? (
          <View
            style={[
              styles.unreadDot,
              { backgroundColor: colors.primary, borderColor: colors.surface },
            ]}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.notificationContent,
          isRTL ? { paddingLeft: 4 } : { paddingRight: 4 },
        ]}
      >
        <View style={[styles.notificationHeader, getFlexDirection(isRTL, 'row')]}>
          <Text
            style={[
              styles.notificationTitle,
              { color: titleColor, fontWeight: isRead ? '500' : '600' },
              getTextAlign(isRTL, 'auto'),
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {!!timeLabel && (
            <Text
              style={[
                styles.notificationTime,
                { color: colors.textMuted },
                getTextAlign(isRTL, 'auto'),
              ]}
              numberOfLines={1}
            >
              {timeLabel}
            </Text>
          )}
        </View>
        <View style={[styles.notificationBody, getFlexDirection(isRTL, 'row')]}>
          <Text
            style={[
              styles.notificationMessage,
              { color: messageColor },
              getTextAlign(isRTL, 'auto'),
            ]}
          >
            {message}
          </Text>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={colors.textMuted}
            style={styles.notificationChevron}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL, language } = useLanguage();
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

  const listFetchInFlight = useRef(false);

  const loadFirstPage = useCallback(async ({ force = false } = {}) => {
    if (!force && listFetchInFlight.current) return;
    listFetchInFlight.current = true;
    try {
      const { rows, hasMore: more } = await fetchPage(0);
      setNotifications(rows);
      setHasMore(more);
    } catch (error) {
      logApiError('NotificationsScreen.loadFirstPage', error);
    } finally {
      listFetchInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || listFetchInFlight.current) return;

    setLoadingMore(true);
    try {
      const { rows, hasMore: more } = await fetchPage(notifications.length);
      setNotifications((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...rows.filter((item) => !seen.has(item.id))];
      });
      setHasMore(more);
    } catch (error) {
      logApiError('NotificationsScreen.loadMore', error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, notifications.length]);

  // Refresh the list whenever this screen is focused so new notifications
  // appear without relying only on the unread badge.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
      refreshUnreadCount();
    }, [loadFirstPage, refreshUnreadCount])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFirstPage({ force: true });
    refreshUnreadCount();
  };

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    decrementUnreadCount();

    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (error) {
      logApiError('NotificationsScreen.markAsRead', error);
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
      logApiError('NotificationsScreen.markAllAsRead', error);
      setNotifications(previous);
      refreshUnreadCount();
    }
  };

  const handlePress = (item) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }

    const destination = resolveNotificationDestination(item);
    if (!destination) return;

    if (destination.method === 'push' && typeof navigation.push === 'function') {
      navigation.push(destination.name, destination.params);
      return;
    }

    navigation.navigate(destination.name, destination.params);
  };

  const dateLocale = getDateLocale(language);
  const sections = useMemo(
    () => groupNotificationsByLocalDay(notifications, dateLocale, t),
    [notifications, dateLocale, t]
  );

  const renderItem = ({ item }) => {
    const timeLabel = formatNotificationTime(item.created_at, language);
    const copy = localizeNotification(item, t, language);
    return (
      <NotificationCard
        item={item}
        title={copy.title}
        message={copy.message}
        timeLabel={timeLabel}
        colors={colors}
        isRTL={isRTL}
        onPress={() => handlePress(item)}
      />
    );
  };

  const renderSectionHeader = ({ section }) => {
    if (!section.title) return null;
    const isFirst = sections[0]?.key === section.key;
    return (
      <Text
        style={[
          styles.sectionHeader,
          { color: colors.text, marginTop: isFirst ? 0 : 8 },
          getTextAlign(isRTL, 'auto'),
        ]}
      >
        {section.title}
      </Text>
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          extraData={{ notifications, language }}
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationIconWrap: {
    width: 32,
    height: 32,
    marginTop: 1,
  },
  notificationIconWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationChevron: {
    marginTop: 2,
  },
  notificationHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 10,
  },
  notificationBody: {
    alignItems: 'flex-start',
    gap: 6,
  },
  notificationTitle: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    flex: 1,
    minWidth: 0,
  },
  notificationTime: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
  },
  notificationMessage: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
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
