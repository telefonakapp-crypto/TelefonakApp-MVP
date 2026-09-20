import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { fonts, radii, space, ambientElevation, brand } from '../utils/designTokens';
import { IconButton } from '../components/ui';
import {
  fetchPushPreference,
  migrateLocalPushPreference,
  updatePushPreference,
  syncDevicePushRegistration,
} from '../utils/pushRegistration';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode, themeMode, changeThemeMode } = useTheme();
  const { language, changeLanguage, t, isRTL } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [preferenceReady, setPreferenceReady] = React.useState(false);
  const [preferenceSaving, setPreferenceSaving] = React.useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const flipBusyRef = useRef(false);

  const handleSelectLanguage = (nextLanguage) => {
    if (nextLanguage === language || flipBusyRef.current) return;
    flipBusyRef.current = true;
    const dir = nextLanguage === 'ar' ? 1 : -1;
    Animated.timing(flip, {
      toValue: dir,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        flip.setValue(0);
        flipBusyRef.current = false;
        return;
      }
      changeLanguage(nextLanguage);
      flip.setValue(-dir);
      Animated.timing(flip, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        flipBusyRef.current = false;
      });
    });
  };

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

  const flipRotateY = flip.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const flipOpacity = flip.interpolate({
    inputRange: [-1, -0.2, 0, 0.2, 1],
    outputRange: [0.35, 1, 1, 1, 0.35],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.View
        collapsable={false}
        style={[
          styles.flipSurface,
          {
            opacity: flipOpacity,
            transform: [{ perspective: 1000 }, { rotateY: flipRotateY }],
          },
        ]}
      >
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

          <View
            style={[
              styles.settingItem,
              styles.appearanceItem,
              { backgroundColor: colors.card },
              ambientElevation,
            ]}
          >
            <View style={[styles.settingInfo, getFlexDirection(isRTL, 'row')]}>
              <Ionicons
                name={isDarkMode ? 'moon' : 'sunny-outline'}
                size={24}
                color={colors.text}
                style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }}
              />
              <View style={[styles.settingText, { marginLeft: isRTL ? 0 : space[3], marginRight: isRTL ? space[3] : 0 }]}>
                <Text style={[styles.settingLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t('settings.appearance')}
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                  {themeMode === 'system'
                    ? t('settings.themeSystemDesc')
                    : themeMode === 'dark'
                      ? t('settings.themeDark')
                      : t('settings.themeLight')}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.languageTrack,
                styles.appearanceTrack,
                { alignSelf: isRTL ? 'flex-start' : 'flex-end' },
              ]}
            >
              {[
                { id: 'light', label: t('settings.themeLight') },
                { id: 'dark', label: t('settings.themeDark') },
                { id: 'system', label: t('settings.themeSystem') },
              ].map((option) => {
                const selected = themeMode === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => changeThemeMode(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.languageSegment,
                      selected && styles.languageSegmentSelected,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.languageSegmentText,
                        selected && styles.languageSegmentTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
            <View style={styles.languageTrack}>
              <TouchableOpacity
                onPress={() => handleSelectLanguage('en')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'en' }}
                style={[
                  styles.languageSegment,
                  language === 'en' && styles.languageSegmentSelected,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.languageSegmentText,
                    language === 'en' && styles.languageSegmentTextSelected,
                  ]}
                >
                  {t('welcome.languageEnglish')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSelectLanguage('ar')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'ar' }}
                style={[
                  styles.languageSegment,
                  language === 'ar' && styles.languageSegmentSelected,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.languageSegmentText,
                    language === 'ar' && styles.languageSegmentTextSelected,
                  ]}
                >
                  {t('welcome.languageArabic')}
                </Text>
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
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flipSurface: {
    flex: 1,
    backfaceVisibility: 'hidden',
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
  appearanceItem: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: space[3],
  },
  appearanceTrack: {
    flexGrow: 0,
    flexShrink: 0,
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
  languageTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  languageSegment: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  languageSegmentSelected: {
    backgroundColor: brand.primary,
  },
  languageSegmentText: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: '#1a1c1c',
    textDecorationLine: 'none',
  },
  languageSegmentTextSelected: {
    color: '#ffffff',
    fontFamily: fonts.labelBold,
    textDecorationLine: 'none',
  },
});

