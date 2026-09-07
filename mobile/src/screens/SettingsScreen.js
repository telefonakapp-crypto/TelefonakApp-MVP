import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import { IconButton } from '../components/ui';
import {
  fetchPushPreference,
  migrateLocalPushPreference,
  updatePushPreference,
  syncDevicePushRegistration,
} from '../utils/pushRegistration';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [preferenceReady, setPreferenceReady] = React.useState(false);
  const [preferenceSaving, setPreferenceSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadPreference = async () => {
      try {
        const serverEnabled = await fetchPushPreference();
        const enabled = await migrateLocalPushPreference(serverEnabled);
        if (!cancelled) {
          setNotificationsEnabled(enabled);
        }
      } catch (error) {
        console.error('Error loading notification preference:', error);
      } finally {
        if (!cancelled) setPreferenceReady(true);
      }
    };

    loadPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNotifications = async (value) => {
    if (preferenceSaving) return;
    const previous = notificationsEnabled;
    setNotificationsEnabled(value);
    setPreferenceSaving(true);
    try {
      const saved = await updatePushPreference(value);
      setNotificationsEnabled(saved);
      if (saved) {
        const registration = await syncDevicePushRegistration({ requestPermission: true });
        if (__DEV__ && !registration?.registered) {
          console.log('[push] preference saved; device token not registered', registration?.reason);
        }
      }
    } catch (error) {
      console.error('Error saving notification preference:', error);
      setNotificationsEnabled(previous);
    } finally {
      setPreferenceSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
        <IconButton
          name={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('settings.settings')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.preferences')}</Text>
          
          <View style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <View style={[styles.settingText, { marginLeft: isRTL ? 0 : space[3], marginRight: isRTL ? space[3] : 0 }]}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.pushNotifications')}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('settings.pushNotificationsDesc')}</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              disabled={!preferenceReady || preferenceSaving}
              trackColor={{ false: isDarkMode ? '#3f3f46' : '#e4e4e7', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name={isDarkMode ? "moon" : "sunny-outline"} size={24} color={colors.text} />
              <View style={[styles.settingText, { marginLeft: isRTL ? 0 : space[3], marginRight: isRTL ? space[3] : 0 }]}>
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

          <View style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="language-outline" size={24} color={colors.text} />
              <View style={[styles.settingText, { marginLeft: isRTL ? 0 : space[3], marginRight: isRTL ? space[3] : 0 }]}>
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
            style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="person-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.editProfile')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
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
          
          <View style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}>
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <View style={[styles.settingText, { marginLeft: isRTL ? 0 : space[3], marginRight: isRTL ? space[3] : 0 }]}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>App Version</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>1.0.0</Text>
              </View>
            </View>
          </View>

          {__DEV__ ? (
            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
              onPress={() => navigation.navigate('ImagePickerDiagnostic')}
              accessibilityRole="button"
              accessibilityLabel="ImagePicker Diagnostic"
            >
              <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
                <Ionicons
                  name="bug-outline"
                  size={24}
                  color={colors.text}
                  style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }}
                />
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  ImagePicker Diagnostic
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('ContactUs')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.helpSupport')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="help-circle-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.helpSupport')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.text} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
              <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('settings.privacyPolicy')}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }, ambientElevation, getFlexDirection(isRTL, 'row')]}
            onPress={() => navigation.navigate('DeleteAccount')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.deleteAccount')}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons
                name="trash-outline"
                size={24}
                color={colors.error}
                style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }}
              />
              <Text style={[styles.settingLabel, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>
                {t('settings.deleteAccount')}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  section: {
    marginBottom: space[5],
  },
  sectionTitle: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: space[2],
    paddingHorizontal: space[1],
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    padding: space[4],
    borderRadius: radii['2xl'],
    marginBottom: space[3],
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  settingDescription: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space[1],
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.xl,
    minWidth: 50,
    alignItems: 'center',
  },
  languageButtonActive: {
    // Already handled by backgroundColor
  },
  languageButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
});

