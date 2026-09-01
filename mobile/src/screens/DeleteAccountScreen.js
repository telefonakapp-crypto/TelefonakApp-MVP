import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import apiClient from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { clearAuthSession } from '../utils/authSession';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { useNotifications } from '../context/NotificationsContext';
import { useOffersUnread } from '../context/OffersUnreadContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const REASON_OPTIONS = [
  { key: 'no_longer_useful', labelKey: 'deleteAccount.reasonNoLongerUseful' },
  { key: 'sold_phone', labelKey: 'deleteAccount.reasonSoldPhone' },
  { key: 'need_a_break', labelKey: 'deleteAccount.reasonNeedBreak' },
  { key: 'not_using_anymore', labelKey: 'deleteAccount.reasonNotUsing' },
];

export default function DeleteAccountScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const { clearFavorites } = useFavorites();
  const { clearUnreadCount } = useNotifications();
  const { clearUnreadOffersCount } = useOffersUnread();
  const [selectedReason, setSelectedReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const clearSessionAndLeave = async () => {
    await clearAuthSession();
    await AsyncStorage.removeItem('hasSeenOnboarding');
    clearFavorites();
    clearUnreadCount();
    clearUnreadOffersCount();
    navigation.reset({
      index: 0,
      routes: [{ name: 'AuthChoice' }],
    });
  };

  const performDeactivate = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/user/deactivate', { reason: selectedReason });
      await clearSessionAndLeave();
    } catch (error) {
      logApiError('DeleteAccountScreen.deactivate', error);
      // If the account is already disabled, still force logout.
      if (error.response?.status === 403 || error.response?.status === 409) {
        await clearSessionAndLeave();
        return;
      }
      Alert.alert(
        t('common.error'),
        getApiErrorMessage(error, t('deleteAccount.failed'))
      );
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (!selectedReason) {
      Alert.alert(t('common.error'), t('deleteAccount.selectReason'));
      return;
    }

    Alert.alert(
      t('deleteAccount.confirmTitle'),
      t('deleteAccount.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deleteAccount.deleteAccount'),
          style: 'destructive',
          onPress: performDeactivate,
        },
      ]
    );
  };

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
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('deleteAccount.title')}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.sorry, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {t('deleteAccount.sorry')}
        </Text>
        <Text style={[styles.prompt, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('deleteAccount.prompt')}
        </Text>

        <View style={[styles.optionsCard, { backgroundColor: colors.surface }]}>
          {REASON_OPTIONS.map((option, index) => {
            const selected = selectedReason === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionRow,
                  getFlexDirection(isRTL, 'row'),
                  index < REASON_OPTIONS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderLight,
                  },
                ]}
                onPress={() => setSelectedReason(option.key)}
                disabled={submitting}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(option.labelKey)}
              >
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: selected ? colors.primary : colors.inputBorder },
                    { marginRight: isRTL ? 0 : 14, marginLeft: isRTL ? 14 : 0 },
                  ]}
                >
                  {selected ? (
                    <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                  ) : null}
                </View>
                <Text style={[styles.optionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                  {t(option.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: selectedReason ? colors.primary : colors.inputBackground },
            submitting && styles.continueBusy,
          ]}
          onPress={handleContinue}
          disabled={!selectedReason || submitting}
          accessibilityRole="button"
          accessibilityLabel={t('deleteAccount.continue')}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.continueText,
                { color: selectedReason ? '#ffffff' : colors.textSecondary },
              ]}
            >
              {t('deleteAccount.continue')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 32,
  },
  sorry: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  prompt: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  optionsCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBusy: {
    opacity: 0.8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
