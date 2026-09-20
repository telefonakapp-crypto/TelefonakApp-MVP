import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import apiClient from '../utils/api';
import { getApiErrorMessage, isNetworkError, logApiError } from '../utils/apiError';
import * as AuthSession from '../utils/authSession';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getMargin, getTextAlign } from '../utils/rtlStyles';
import { fonts, brand, radii } from '../utils/designTokens';
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  classifyOtpRequestFailure,
  getResendCooldownFromSuccess,
  useOtpCooldown,
} from '../utils/otpCooldown';
import { showToast } from '../utils/toast';
import { showDevOtpAlert } from '../utils/devOtpDiagnostic';

export default function OTPScreen() {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { t, isRTL } = useLanguage();
  // 'phone-change' reuses this screen for a logged-in user verifying a new
  // number; without it the screen behaves exactly as it did for login/sign up.
  const { phoneNumber, isSignUp, purpose, cooldownSeconds } = route.params || {};
  const isPhoneChange = purpose === 'phone-change';

  const initialCooldown =
    cooldownSeconds != null
      ? Math.max(0, Math.ceil(Number(cooldownSeconds) || 0))
      : OTP_RESEND_COOLDOWN_SECONDS;

  const {
    secondsLeft,
    isCoolingDown,
    startCooldown,
    beginRequest,
    endRequest,
  } = useOtpCooldown(initialCooldown);

  const persistSession = async (payload) => {
    if (typeof AuthSession.setAuthSession === 'function') {
      await AuthSession.setAuthSession(payload);
      return;
    }
    // Defensive fallback if a stale Metro bundle omitted the named export.
    if (typeof AuthSession.setAuthToken === 'function' && payload?.token) {
      await AuthSession.setAuthToken(
        payload.token,
        Object.prototype.hasOwnProperty.call(payload, 'refresh_token')
          ? payload.refresh_token || null
          : null
      );
      return;
    }
    throw new Error('Auth session storage is unavailable');
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 4) {
      Alert.alert(t('common.error'), t('auth.completeOtp'));
      return;
    }

    setVerifying(true);
    try {
      if (isPhoneChange) {
        // The server verifies against the pending change it stored, so the
        // number is never sent from here.
        const response = await apiClient.post('/profile/change-phone/verify', { otp });

        if (response.data?.token) {
          // The old token still carries the previous number.
          await persistSession(response.data);
        }

        Alert.alert(t('common.success'), t('changePhone.success'), [
          { text: t('common.ok'), onPress: () => navigation.navigate('Profile') },
        ]);
        return;
      }

      const response = await apiClient.post('/auth/verify-otp', {
        phone_number: phoneNumber,
        otp: otp,
      });

      if (response.data) {
        // New users finish registration; existing users (login or signup) go Home.
        if (response.data.isNewUser) {
          // Persist the temporary verified session so Register (and app restart)
          // use it — never leave a stale customer JWT as the active session.
          await persistSession(response.data);
          // navigate (not replace) so Complete Profile can go back to OTP.
          navigation.navigate('Register', { token: response.data.token });
        } else {
          await persistSession(response.data);
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            })
          );
        }
      }
    } catch (error) {
      logApiError('OTPScreen.verifyOTP', error);

      let message = t('auth.couldNotCompleteSignIn');
      if (error?.response) {
        // Only use OTP copy when the backend actually rejected the code.
        message = getApiErrorMessage(error, t('auth.invalidOrExpiredOTP'));
      } else if (isNetworkError(error)) {
        message = getApiErrorMessage(error, t('common.networkError'));
      } else if (
        /auth session|SecureStore|is not a function|storage is unavailable/i.test(
          String(error?.message || '')
        )
      ) {
        message = t('auth.couldNotSaveSession');
      }

      Alert.alert(t('common.error'), message);
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (isCoolingDown) {
      showToast(t('auth.otpCooldownWait').replace('{seconds}', String(secondsLeft)));
      return;
    }

    if (!beginRequest()) return;

    setResending(true);
    try {
      const response = isPhoneChange
        ? await apiClient.post('/profile/change-phone/request', { new_phone_number: phoneNumber })
        : await apiClient.post('/auth/request-otp', { phone_number: phoneNumber });

      if (response.data) {
        startCooldown(getResendCooldownFromSuccess(response.data));
        setOtp('');
        if (__DEV__) {
          showDevOtpAlert(response.data, t('auth.otpSent'));
        }
      }
    } catch (error) {
      const failure = classifyOtpRequestFailure(error);
      if (failure.kind === 'resend_cooldown') {
        startCooldown(failure.seconds);
        showToast(t('auth.otpCooldownWait').replace('{seconds}', String(failure.seconds)));
        return;
      }
      if (failure.kind === 'request_window') {
        // Hourly budget — do NOT drive the Resend countdown with multi-minute waits.
        const minutes = Math.max(1, Math.ceil((Number(failure.seconds) || 60) / 60));
        showToast(t('auth.otpRequestWindow').replace('{minutes}', String(minutes)));
        return;
      }

      logApiError('OTPScreen.resendOTP', error);
      showToast(getApiErrorMessage(error, t('auth.failedToResendOTP')));
    } finally {
      endRequest();
      setResending(false);
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  const busy = verifying || resending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
            <TouchableOpacity
              onPress={goBack}
              style={[styles.backButton, getMargin(isRTL, { left: -12, right: 0 })]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons
                name={isRTL ? 'arrow-forward' : 'arrow-back'}
                size={24}
                color="#09090b"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, getTextAlign(isRTL, 'left')]}>
                {t('auth.verifyItsYou')}
              </Text>
              <Text style={[styles.description, getTextAlign(isRTL, 'left')]}>
                {t('auth.weSentACodeTo')}{' '}
                <Text style={styles.phoneNumberBold}>+962 {phoneNumber}</Text>
              </Text>
            </View>

            <View style={styles.otpContainer}>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(text) => {
                  const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setOtp(numericText);
                }}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
              <View style={styles.otpTrack}>
                {[0, 1, 2, 3].map((index) => (
                  <React.Fragment key={index}>
                    {index > 0 ? <View style={styles.otpSeparator} /> : null}
                    <View
                      style={[
                        styles.otpCell,
                        otp.length === index && styles.otpCellFocused,
                      ]}
                    >
                      <Text style={styles.otpBoxText}>{otp[index] || ''}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>

            <View style={styles.resendContainer}>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resending}
                accessibilityState={{ disabled: isCoolingDown || resending }}
              >
                <Text
                  style={[
                    styles.resendButton,
                    (isCoolingDown || resending) && styles.resendButtonDisabled,
                  ]}
                >
                  {isCoolingDown
                    ? t('auth.resendCodeIn').replace('{seconds}', String(secondsLeft))
                    : resending
                      ? t('auth.sending')
                      : t('auth.resendCode')}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, (busy || otp.length !== 4) && styles.verifyButtonDisabled]}
              onPress={handleVerifyOTP}
              disabled={busy || otp.length !== 4}
            >
              {verifying ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyButtonText}>{t('auth.verifyCode')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.surface,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24, // p-6
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  formContainer: {
    flexGrow: 0,
  },
  titleContainer: {
    marginBottom: 28,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: brand.onSurface,
    marginBottom: 10,
    textAlign: 'left',
  },
  description: {
    fontFamily: fonts.body,
    color: brand.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  phoneNumberBold: {
    fontFamily: fonts.bodyMedium,
    color: brand.onSurface,
  },
  otpContainer: {
    position: 'relative',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  otpInput: {
    position: 'absolute',
    width: '100%',
    height: 56,
    opacity: 0,
    zIndex: 1,
  },
  otpTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 56,
    backgroundColor: '#F2F4F7',
    borderRadius: 16,
    overflow: 'hidden',
  },
  otpSeparator: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 14,
    backgroundColor: 'rgba(193, 198, 212, 0.55)',
  },
  otpCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  otpCellFocused: {
    borderBottomColor: brand.primary,
  },
  otpBoxText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: brand.onSurface,
    textAlign: 'center',
    includeFontPadding: false,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  resendButton: {
    fontFamily: fonts.label,
    color: brand.primary,
    fontSize: 15,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  verifyButton: {
    width: '100%',
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontFamily: fonts.labelBold,
    color: '#ffffff',
    fontSize: 18,
  },
});
