import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { useNotifications } from '../context/NotificationsContext';
import { useOffersUnread } from '../context/OffersUnreadContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import apiClient from '../utils/api';
import { ignoreIfMaintenance } from '../utils/maintenance';
import { clearAuthSession, getRefreshToken } from '../utils/authSession';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import { EmptyState, IconButton, ProfileScreenSkeleton } from '../components/ui';

function ProfileRow({ icon, label, onPress, colors, isRTL }) {
  return (
    <TouchableOpacity
      style={[styles.row, getFlexDirection(isRTL, 'row')]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: colors.surfaceContainerLow,
            marginRight: isRTL ? 0 : space[3],
            marginLeft: isRTL ? space[3] : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.rowText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
        {label}
      </Text>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

function ProfileSection({ title, rows, colors, isRTL }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
        {title}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.card }, ambientElevation]}>
        {rows.map((row, index) => (
          <ProfileRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            onPress={row.onPress}
            colors={colors}
            isRTL={isRTL}
          />
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const { clearFavorites } = useFavorites();
  const { clearUnreadCount } = useNotifications();
  const { clearUnreadOffersCount } = useOffersUnread();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await apiClient.get('/user/profile');
      setUser(response.data.user);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      console.error('Error fetching profile:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [fetchUserProfile])
  );

  const go = (screen) => () => navigation.navigate(screen);

  const handleLogout = () => {
    Alert.alert(
      t('common.logout') || 'Logout',
      t('common.logoutConfirm') || 'Are you sure you want to logout?',
      [
        {
          text: t('common.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('common.logout') || 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const refreshToken = await getRefreshToken();
              try {
                await apiClient.post('/auth/logout', {
                  refresh_token: refreshToken || undefined,
                });
              } catch {
                // Best-effort server revoke; always clear local session.
              }
              await clearAuthSession();
              await AsyncStorage.removeItem('hasSeenOnboarding');
              clearFavorites();
              clearUnreadCount();
              clearUnreadOffersCount();
              navigation.reset({
                index: 0,
                routes: [{ name: 'AuthChoice' }],
              });
            } catch (error) {
              console.error('Logout error:', error?.message || 'failed');
              Alert.alert(
                t('common.error') || 'Error',
                t('common.failedToLogout') || 'Failed to logout. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const sections = [
    {
      title: t('profile.sectionAccount'),
      rows: [
        {
          key: 'editProfile',
          icon: 'person-outline',
          label: t('profile.editProfile'),
          onPress: go('EditProfile'),
        },
      ],
    },
    {
      title: t('profile.sectionPreferences'),
      rows: [
        {
          key: 'settings',
          icon: 'settings-outline',
          label: t('profile.settings'),
          onPress: go('Settings'),
        },
      ],
    },
    {
      title: t('profile.sectionActivity'),
      rows: [
        {
          key: 'myListings',
          icon: 'list-outline',
          label: t('profile.myListings'),
          onPress: go('MyListings'),
        },
        {
          key: 'saved',
          icon: 'heart-outline',
          label: t('profile.savedListings'),
          onPress: go('SavedListings'),
        },
        {
          key: 'myOffers',
          icon: 'pricetag-outline',
          label: t('offers.myOffers'),
          onPress: go('MyOffers'),
        },
        {
          key: 'receivedOffers',
          icon: 'pricetags-outline',
          label: t('offers.receivedOffers'),
          onPress: go('ReceivedOffers'),
        },
      ],
    },
    {
      title: t('profile.sectionSupport'),
      rows: [
        {
          key: 'userGuide',
          icon: 'book-outline',
          label: t('profile.userGuide'),
          onPress: go('UserGuide'),
        },
        {
          key: 'privacy',
          icon: 'shield-checkmark-outline',
          label: t('profile.privacyPolicy'),
          onPress: go('PrivacyPolicy'),
        },
        {
          key: 'terms',
          icon: 'document-text-outline',
          label: t('profile.termsOfUse'),
          onPress: go('TermsOfUse'),
        },
        {
          key: 'contact',
          icon: 'chatbubble-ellipses-outline',
          label: t('profile.contactUs'),
          onPress: go('ContactUs'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
        <IconButton
          name={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('profile.profile')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ProfileScreenSkeleton />
      ) : loadError && !user ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('common.error')}
          description={t('common.somethingWentWrong')}
          actionLabel={t('common.retry')}
          onAction={fetchUserProfile}
          style={styles.profileError}
        />
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.profileSection}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="person" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.profileName, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
              {user ? `${user.first_name} ${user.last_name}` : t('profile.userProfile')}
            </Text>
            {user?.phone_number ? (
              <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>
                {user.phone_number}
              </Text>
            ) : null}
          </View>

          {sections.map((section) => (
            <ProfileSection
              key={section.title}
              title={section.title}
              rows={section.rows}
              colors={colors}
              isRTL={isRTL}
            />
          ))}

          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor: colors.surface,
                borderColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
              },
              getFlexDirection(isRTL, 'row'),
            ]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel={t('common.logout')}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
            <Text
              style={[
                styles.logoutButtonText,
                { color: colors.error },
                getTextAlign(isRTL, 'center'),
              ]}
            >
              {t('common.logout')}
            </Text>
          </TouchableOpacity>
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
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 18,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  profileError: { flex: 1 },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: space[6],
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space[4],
  },
  profileName: {
    fontFamily: fonts.headline,
    fontSize: 22,
  },
  profilePhone: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space[1],
  },
  section: {
    marginBottom: space[5],
  },
  sectionTitle: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: space[2],
    marginHorizontal: space[1],
  },
  group: {
    borderRadius: radii['2xl'] + 4,
    overflow: 'hidden',
    paddingVertical: space[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 56,
    marginTop: space[2],
    marginBottom: space[4],
    paddingHorizontal: space[4],
    borderRadius: radii['2xl'],
    borderWidth: 1,
  },
  logoutButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
  },
});
