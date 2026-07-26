import React, { useState, useRef, useEffect } from 'react';
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
import apiClient, { API_BASE_URL } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OTPScreen() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const navigation = useNavigation();
  const route = useRoute();
  const { phoneNumber, isSignUp } = route.params || {};

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 4) {
      Alert.alert('Error', 'Please enter the complete 4-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/verify-otp', {
        phone_number: phoneNumber,
        otp: otp,
      });

      if (response.data) {
        if (isSignUp) {
          // Sign up flow - always go to registration
          navigation.replace('Register', { token: response.data.token });
        } else {
          // Login flow - check if user is new or existing
          if (response.data.isNewUser) {
            // This shouldn't happen in login flow, but handle it
            navigation.replace('Register', { token: response.data.token });
          } else {
            // Existing user - save token and go directly to Home
            await AsyncStorage.setItem('authToken', response.data.token);
            // Reset navigation stack to prevent going back to OTP/Login
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            );
          }
        }
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Invalid OTP. Please try again.'
      );
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/request-otp', {
        phone_number: phoneNumber,
      });

      if (response.data) {
        setTimer(30);
        setOtp('');
        if (response.data.otp) {
          Alert.alert('OTP', `Your OTP is: ${response.data.otp} (Development mode)`);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#09090b" />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Verify it's you</Text>
              <Text style={styles.description}>
                We sent a code to <Text style={styles.phoneNumberBold}>+962 {phoneNumber}</Text>
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
              <View style={styles.otpBoxes}>
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      otp.length === index && styles.otpBoxFocused,
                    ]}
                  >
                    <Text style={styles.otpBoxText}>{otp[index] || ''}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.resendContainer}>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={timer > 0 || loading}
              >
                <Text style={[styles.resendButton, (timer > 0 || loading) && styles.resendButtonDisabled]}>
                  {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code in 30s'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, (loading || otp.length !== 4) && styles.verifyButtonDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading || otp.length !== 4}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Code</Text>
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
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24, // p-6
  },
  header: {
    height: 64, // h-16
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24, // mb-6
  },
  backButton: {
    marginLeft: -12, // -ml-3 equivalent
    padding: 8,
  },
  formContainer: {
    flex: 1,
  },
  titleContainer: {
    marginBottom: 32, // space-y-8 equivalent
  },
  title: {
    fontSize: 30, // text-3xl
    fontWeight: 'bold',
    color: '#09090b', // text-foreground
    marginBottom: 8, // mb-2
  },
  description: {
    color: '#71717a', // text-muted-foreground
    fontSize: 16,
    lineHeight: 24,
  },
  phoneNumberBold: {
    fontWeight: '500',
    color: '#09090b', // text-foreground
  },
  otpContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 32, // space-y-8
  },
  otpInput: {
    position: 'absolute',
    width: '100%',
    height: 64,
    opacity: 0,
    zIndex: 1,
  },
  otpBoxes: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  otpBox: {
    width: 56, // w-14
    height: 64, // h-16
    borderRadius: 12, // rounded-xl
    borderWidth: 2, // border-2
    borderColor: '#e4e4e7', // border default
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8, // gap-4 equivalent (16/2)
  },
  otpBoxFocused: {
    borderColor: '#667eea', // border-primary
  },
  otpBoxText: {
    fontSize: 24, // text-2xl
    fontWeight: '600',
    color: '#09090b',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32, // space-y-8
  },
  resendButton: {
    color: '#667eea', // text-primary
    fontSize: 16,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  verifyButton: {
    width: '100%',
    height: 48, // h-12
    borderRadius: 12, // rounded-xl
    backgroundColor: '#667eea', // primary color
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 18, // text-lg
    fontWeight: '600',
  },
});
