import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { openPhoneDialer } from '../utils/phoneDialer';
import { showToast } from '../utils/toast';
import {
  getCachedContactSettings,
  refreshContactSettings,
} from '../utils/contactSettings';

export default function ContactUsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [contact, setContact] = useState(getCachedContactSettings);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      refreshContactSettings()
        .then((next) => {
          if (active) setContact(next);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const handleEmailSupport = async () => {
    const email = contact.contact_email;
    if (!email) {
      showToast(t('contactUs.emailUnavailable'));
      return;
    }
    const url = `mailto:${email}?subject=${encodeURIComponent('Telefonak Support')}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showToast(t('contactUs.emailUnavailable'));
        return;
      }
      await Linking.openURL(url);
    } catch {
      showToast(t('contactUs.emailUnavailable'));
    }
  };

  const handleCallSupport = () => {
    openPhoneDialer(contact.contact_phone, {
      unavailableMessage: t('contactUs.phoneUnavailable'),
      dialerUnavailableMessage: t('common.phoneDialerUnavailable'),
    });
  };

  const rows = [
    {
      key: 'email',
      icon: 'mail-outline',
      label: t('contactUs.emailSupport'),
      value: contact.contact_email,
      onPress: handleEmailSupport,
    },
    {
      key: 'call',
      icon: 'call-outline',
      label: t('contactUs.callSupport'),
      value: contact.contact_phone,
      onPress: handleCallSupport,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerLeft}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('contactUs.title')}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.headerSpinner} />
        ) : (
          <View style={styles.headerSpinner} />
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.intro, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('contactUs.subtitle')}
        </Text>

        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          {rows.map((row, index) => (
            <TouchableOpacity
              key={row.key}
              style={[
                styles.row,
                getFlexDirection(isRTL, 'row'),
                index < rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.borderLight,
                },
              ]}
              onPress={row.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}, ${row.value}`}
            >
              <Ionicons
                name={row.icon}
                size={22}
                color={colors.primary}
                style={{ marginRight: isRTL ? 0 : 14, marginLeft: isRTL ? 14 : 0 }}
              />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {row.label}
                </Text>
                <Text
                  style={[styles.rowValue, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}
                  numberOfLines={1}
                >
                  {row.value}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
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
    padding: 24,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 40,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSpinner: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  group: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    marginTop: 2,
  },
});
