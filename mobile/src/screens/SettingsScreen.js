import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  React.useEffect(() => {
    // Load saved preference for push notifications
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem('pushNotificationsEnabled');
        if (stored !== null) {
          setNotificationsEnabled(stored === 'true');
        }
      } catch (error) {
        console.error('Error loading notification preference:', error);
      }
    };

    loadPreference();
  }, []);

  const handleToggleNotifications = async (value) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('pushNotificationsEnabled', value ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving notification preference:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('hasSeenOnboarding');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('settings.settings')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.preferences')}</Text>
          
          <View style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.pushNotifications')}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('settings.pushNotificationsDesc')}</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: isDarkMode ? '#3f3f46' : '#e4e4e7', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name={isDarkMode ? "moon" : "sunny-outline"} size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.darkMode')}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                  {isDarkMode ? t('settings.lightModeDesc') : t('settings.darkModeDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: isDarkMode ? '#3f3f46' : '#e4e4e7', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="language-outline" size={24} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.language')}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                  {language === 'en' ? 'English' : 'العربية'}
                </Text>
              </View>
            </View>
            <View style={styles.languageButtons}>
              <TouchableOpacity
                style={[
                  styles.languageButton,
                  { backgroundColor: language === 'en' ? colors.primary : colors.inputBackground },
                  language === 'en' && styles.languageButtonActive
                ]}
                onPress={() => changeLanguage('en')}
              >
                <Text style={[
                  styles.languageButtonText,
                  { color: language === 'en' ? '#ffffff' : colors.text }
                ]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageButton,
                  { backgroundColor: language === 'ar' ? colors.primary : colors.inputBackground },
                  language === 'ar' && styles.languageButtonActive
                ]}
                onPress={() => changeLanguage('ar')}
              >
                <Text style={[
                  styles.languageButtonText,
                  { color: language === 'ar' ? '#ffffff' : colors.text }
                ]}>AR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.account')}</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="person-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.editProfile')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('MyListings')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="list-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.myListings')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.about')}</Text>
          
          <View style={[styles.settingItem, { backgroundColor: colors.surface }, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>App Version</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>1.0.0</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.surface }]}
            onPress={() => Alert.alert('Help', 'For support, please contact us at support@telefonak.com')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="help-circle-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.helpSupport')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.surface }]}
            onPress={() => Alert.alert('Privacy Policy', 'Privacy policy content goes here')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.privacyPolicy')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }, getFlexDirection(isRTL, 'row')]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color={colors.error} />
          <Text style={[styles.logoutButtonText, { color: colors.error }, getTextAlign(isRTL, 'center')]}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  languageButtonActive: {
    // Already handled by backgroundColor
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

