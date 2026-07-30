import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { formatPhoneNumber, isValidPhoneNumber, PHONE_NUMBER_LENGTH } from '../utils/phone';

export default function ChangePhoneScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [currentPhone, setCurrentPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Shown for context, and lets the screen flag "same as current" locally.
    apiClient
      .get('/user/profile')
      .then((response) => setCurrentPhone(response.data.user?.phone_number || ''))
      .catch((error) => console.error('Error fetching profile:', error.response?.data || error.message));
  }, []);

  const requestCode = async () => {
    if (!isValidPhoneNumber(newPhone)) {
      Alert.alert(t('common.error'), t('auth.invalidPhoneNumber'));
      return;
    }

    if (newPhone === formatPhoneNumber(currentPhone)) {
      Alert.alert(t('common.error'), t('changePhone.sameAsCurrent'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/profile/change-phone/request', {
        new_phone_number: newPhone,
      });

      navigation.navigate('OTP', { phoneNumber: newPhone, purpose: 'phone-change' });

      if (response.data?.otp) {
        Alert.alert(t('auth.otpSent'), `Your OTP is: ${response.data.otp} (Development mode)`);
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error.response?.data?.error || t('auth.failedToSendOTP')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('changePhone.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Text style={[styles.description, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('changePhone.description')}
        </Text>

        {currentPhone ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
              {t('changePhone.currentNumber')}
            </Text>
            <Text style={[styles.currentPhone, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {currentPhone}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('changePhone.newNumber')}
          </Text>
          <View style={[styles.phoneInputWrapper, { backgroundColor: colors.surface, borderColor: colors.inputBorder }, getFlexDirection(isRTL, 'row')]}>
            <Text style={[styles.countryCode, { color: colors.textSecondary }]}>+962</Text>
            <TextInput
              style={[styles.input, { color: colors.text }, getTextAlign(isRTL, 'auto')]}
              placeholder="7XXXXXXXX"
              placeholderTextColor={colors.textSecondary}
              value={newPhone}
              onChangeText={(text) => setNewPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
              maxLength={PHONE_NUMBER_LENGTH}
              autoFocus
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
          onPress={requestCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>{t('changePhone.continue')}</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.note, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('changePhone.note')}
        </Text>
      </KeyboardAvoidingView>
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
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  currentPhone: {
    fontSize: 16,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
});
