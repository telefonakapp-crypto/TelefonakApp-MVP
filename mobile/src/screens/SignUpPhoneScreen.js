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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { classifyAuthToken, clearAuthSession, getAuthToken } from '../utils/authSession';
import { formatPhoneNumber, PHONE_NUMBER_LENGTH } from '../utils/phone';
import {
  classifyOtpRequestFailure,
  formatOtpCooldownToast,
  formatOtpRequestWindowToast,
  getResendCooldownFromSuccess,
  useOtpCooldown,
} from '../utils/otpCooldown';
import { showToast } from '../utils/toast';
import { fonts, brand, gradients, radii } from '../utils/designTokens';

const LOGO = require('../../assets/telefonak-app-icon-v5.png');

export default function SignUpPhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const {
    secondsLeft,
    isCoolingDown,
    startCooldown,
    beginRequest,
    endRequest,
  } = useOtpCooldown(0);

  useEffect(() => {
    // Signup must not inherit a previous *customer* session. Never wipe an
    // in-progress registration token (phone verified, profile incomplete).
    (async () => {
      const token = await getAuthToken();
      if (classifyAuthToken(token) === 'customer') {
        await clearAuthSession();
      }
    })();
  }, []);

  const handleRequestOTP = async () => {
    if (!phoneNumber || phoneNumber.length !== PHONE_NUMBER_LENGTH) {
      Alert.alert('Error', 'Please enter a valid Jordanian phone number');
      return;
    }

    if (isCoolingDown) {
      showToast(formatOtpCooldownToast(secondsLeft));
      return;
    }

    if (!beginRequest()) return;

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/request-otp', {
        phone_number: phoneNumber,
      });

      if (response.data) {
        const cooldown = getResendCooldownFromSuccess(response.data);
        startCooldown(cooldown);
        navigation.navigate('OTP', {
          phoneNumber,
          isSignUp: true,
          cooldownSeconds: cooldown,
        });
        if (response.data.otp) {
          Alert.alert('OTP Sent', `Your OTP is: ${response.data.otp} (Development mode)`);
        }
      }
    } catch (error) {
      const failure = classifyOtpRequestFailure(error);
      if (failure.kind === 'resend_cooldown') {
        startCooldown(failure.seconds);
        showToast(formatOtpCooldownToast(failure.seconds));
        return;
      }
      if (failure.kind === 'request_window') {
        showToast(formatOtpRequestWindowToast(failure.seconds));
        return;
      }

      logApiError('SignUpPhoneScreen.requestOTP', error);
      showToast(getApiErrorMessage(error, 'Failed to send OTP. Please try again.'));
    } finally {
      endRequest();
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? 'Sending...'
    : isCoolingDown
      ? `Resend code in ${secondsLeft}s`
      : 'Send OTP';

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('AuthChoice');
  };

  return (
    <LinearGradient colors={gradients.primary} style={styles.container}>
      <SafeAreaView style={styles.backSafeArea} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity
          onPress={goBack}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
      </SafeAreaView>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Telefonak" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Enter your phone number to get started</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneInputWrapper}>
              <Text style={styles.countryCode}>+962</Text>
              <TextInput
                style={styles.input}
                placeholder="7XXXXXXXX"
                placeholderTextColor="#999"
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || isCoolingDown) && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
            accessibilityState={{ disabled: loading || isCoolingDown }}
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  backButton: {
    padding: 8,
    marginLeft: 12,
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 32,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 10,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radii.xl,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(193, 198, 212, 0.2)',
  },
  countryCode: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
    color: brand.onSurface,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: brand.onSurface,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: radii.xl,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fonts.labelBold,
    color: brand.primary,
    fontSize: 18,
  },
  terms: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 30,
    opacity: 0.7,
  },
});
