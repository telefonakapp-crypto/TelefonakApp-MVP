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
import apiClient from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import { formatPhoneNumber, PHONE_NUMBER_LENGTH } from '../utils/phone';

export default function SignUpPhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleRequestOTP = async () => {
    if (!phoneNumber || phoneNumber.length !== PHONE_NUMBER_LENGTH) {
      Alert.alert('Error', 'Please enter a valid Jordanian phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/request-otp', {
        phone_number: phoneNumber,
      });

      if (response.data) {
        navigation.navigate('OTP', { phoneNumber, isSignUp: true });
        if (response.data.otp) {
          Alert.alert('OTP Sent', `Your OTP is: ${response.data.otp} (Development mode)`);
        }
      }
    } catch (error) {
      logApiError('SignUpPhoneScreen.requestOTP', error);
      Alert.alert(
        'Error',
        getApiErrorMessage(error, 'Failed to send OTP. Please try again.')
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
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
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
    marginRight: 10,
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

