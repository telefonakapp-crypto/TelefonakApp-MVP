import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import apiClient, { API_BASE_URL } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { formatPhoneNumber, PHONE_NUMBER_LENGTH } from '../utils/phone';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();

  const handleRequestOTP = async () => {
    if (!phoneNumber || phoneNumber.length !== PHONE_NUMBER_LENGTH) {
      Alert.alert(t('common.error'), t('auth.invalidPhoneNumber'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/request-otp', {
        phone_number: phoneNumber,
      });

      if (response.data) {
        navigation.navigate('OTP', { phoneNumber, isSignUp: false });
        if (response.data.otp) {
          Alert.alert(t('auth.otpSent'), `Your OTP is: ${response.data.otp} (Development mode)`);
        }
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
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>📱</Text>
          <Text style={[styles.title, getTextAlign(isRTL, 'center')]}>{t('auth.welcomeBack')}</Text>
          <Text style={[styles.subtitle, getTextAlign(isRTL, 'center')]}>{t('auth.enterPhoneNumber')}</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, getTextAlign(isRTL, 'auto')]}>{t('auth.phoneNumber')}</Text>
            <View style={[styles.phoneInputWrapper, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.countryCode, { marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }]}>+962</Text>
              <TextInput
                style={[styles.input, getTextAlign(isRTL, 'left')]}
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
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? t('auth.sending') : t('auth.sendOTP')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.terms, getTextAlign(isRTL, 'center')]}>
            {t('auth.termsAgreement')}
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logo: {
    fontSize: 60,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
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
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 10,
    fontWeight: '600',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  countryCode: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  terms: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 30,
    opacity: 0.7,
  },
});

