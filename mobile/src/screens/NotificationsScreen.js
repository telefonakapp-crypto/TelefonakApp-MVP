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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setNotifications([]);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/admin/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error.response?.data || error.message);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      await axios.put(
        `${API_BASE_URL}/admin/notifications/${id}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error.response?.data || error.message);
    }
  };

  const renderIconForType = (type) => {
    switch (type) {
      case 'listing_approved':
        return <Ionicons name="checkmark-circle" size={24} color="#22c55e" />;
      case 'listing_declined':
        return <Ionicons name="close-circle" size={24} color="#ef4444" />;
      case 'new_listing':
        return <Ionicons name="add-circle" size={24} color="#667eea" />;
      default:
        return <Ionicons name="notifications-outline" size={24} color="#667eea" />;
    }
  };

  const renderItem = ({ item }) => {
    const createdAt = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : '';

    const isDeclined = item.type === 'listing_declined';
    const isApproved = item.type === 'listing_approved';
    const isNewListing = item.type === 'new_listing';

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          { backgroundColor: colors.surface },
          !item.is_read && [styles.notificationCardUnread, { 
            [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 3,
            [isRTL ? 'borderRightColor' : 'borderLeftColor']: colors.primary 
          }],
          getFlexDirection(isRTL, 'row'),
        ]}
        onPress={() => {
          if (!item.is_read) {
            markAsRead(item.id);
          }
        }}
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
              isDeclined && styles.declinedText,
              isApproved && styles.approvedText,
              isNewListing && styles.newListingText,
              getTextAlign(isRTL, 'auto'),
            ]}
          >
            {item.message}
          </Text>
        </View>
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
        <View style={{ width: 24 }} />
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
  notificationIcon: {
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
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
  brandInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
});


