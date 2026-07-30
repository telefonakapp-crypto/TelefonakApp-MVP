import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { useNotifications } from '../context/NotificationsContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { API_BASE_URL } from '../utils/api';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const { clearFavorites } = useFavorites();
  const { clearUnreadCount } = useNotifications();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Refresh profile when screen comes into focus (e.g., after editing profile)
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [fetchUserProfile])
  );

  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('hasSeenOnboarding');
              clearFavorites();
              clearUnreadCount();
              navigation.reset({
                index: 0,
                routes: [{ name: 'AuthChoice' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('common.error'), t('profile.failedToLogout'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('profile.profile')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.profileSection}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="person" size={60} color={colors.primary} />
            </View>
            <Text style={[styles.profileName, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
              {user ? `${user.first_name} ${user.last_name}` : t('profile.userProfile')}
            </Text>
            {user?.phone_number && (
              <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{user.phone_number}</Text>
            )}
          </View>

        <View style={[styles.menuSection, { backgroundColor: colors.surface }]}>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('SavedListings')}
          >
            <Ionicons name="heart-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }} />
            <Text style={[styles.menuItemText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('profile.savedListings')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('MyOffers')}
          >
            <Ionicons name="pricetag-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }} />
            <Text style={[styles.menuItemText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('offers.myOffers')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('ReceivedOffers')}
          >
            <Ionicons name="pricetags-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }} />
            <Text style={[styles.menuItemText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('offers.receivedOffers')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('ChangePhone')}
          >
            <Ionicons name="call-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }} />
            <Text style={[styles.menuItemText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('profile.changePhoneNumber')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }} />
            <Text style={[styles.menuItemText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('profile.settings')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        </ScrollView>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
  },
  profilePhone: {
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminText: {
    fontWeight: '600',
  },
  menuSection: {
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

