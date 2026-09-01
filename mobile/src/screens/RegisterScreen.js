import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  FlatList,
  Pressable,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../utils/api';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import {
  classifyAuthToken,
  getAuthToken,
} from '../utils/authSession';
import * as AuthSession from '../utils/authSession';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  formatPickerDateYYYYMMDD,
  parsePickerDateYYYYMMDD,
  todayAsPickerDate,
  deviceTimeZoneName,
} from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';
import { fonts, brand, gradients, radii } from '../utils/designTokens';
import { USER_GENDERS, userGenderLabel } from '../utils/userGender';

const isValidEmail = (email) => {
  const regex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

const CITY_OPTIONS = [
  'Amman',
  'Irbid',
  'Zarqa',
  'Balqa',
  'Madaba',
  'Karak',
  'Tafilah',
  "Ma'an",
  'Aqaba',
  'Jerash',
  'Ajloun',
  'Mafraq',
];

const LOGO = require('../../assets/telefonak-app-icon-v5.png');

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    email: '',
    date_of_birth: '',
    city: '',
  });
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [showDOBPicker, setShowDOBPicker] = useState(false);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const scrollViewRef = useRef(null);
  const datePickerContainerRef = useRef(null);
  const [datePickerY, setDatePickerY] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { t, isRTL } = useLanguage();
  const { token } = route.params || {};

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const scrollToDatePicker = () => {
    if (scrollViewRef.current && datePickerY > 0) {
      try {
        if (scrollViewRef.current.scrollToPosition) {
          scrollViewRef.current.scrollToPosition(0, datePickerY - 20, true);
        } else if (scrollViewRef.current.getScrollResponder) {
          const scrollResponder = scrollViewRef.current.getScrollResponder();
          if (scrollResponder && scrollResponder.scrollTo) {
            scrollResponder.scrollTo({ y: datePickerY - 20, animated: true });
          }
        }
      } catch (error) {
        console.error('Error scrolling to date picker:', error);
      }
    }
  };

  const handleRegister = async () => {
    if (!formData.first_name.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      firstNameRef.current?.focus();
      return;
    }

    if (!formData.last_name.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      lastNameRef.current?.focus();
      return;
    }

    if (!formData.gender) {
      Alert.alert('Error', 'Please select your gender');
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      emailRef.current?.focus();
      return;
    }

    if (!isValidEmail(formData.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      emailRef.current?.focus();
      return;
    }

    if (!formData.date_of_birth) {
      Alert.alert('Error', 'Please select your date of birth');
      setShowDOBPicker(true);
      return;
    }

    if (!formData.city) {
      Alert.alert('Error', 'Please select your city');
      return;
    }

    setLoading(true);
    try {
      // Prefer the navigation token from OTP verify; fall back to the persisted
      // registration session (needed after app restart mid-signup).
      const storedToken = await getAuthToken();
      const verificationToken =
        (token && classifyAuthToken(token) === 'registration' && token) ||
        (classifyAuthToken(storedToken) === 'registration' && storedToken) ||
        null;

      if (!verificationToken) {
        Alert.alert(
          'Verification required',
          'Phone number not verified.\n\nPlease verify your phone number before completing registration.'
        );
        return;
      }

      const response = await apiClient.post('/user/register', formData, {
        headers: {
          Authorization: `Bearer ${verificationToken}`,
        },
      });

      if (response.data) {
        await AuthSession.setAuthSession(response.data);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
      }
    } catch (error) {
      logApiError('RegisterScreen.register', error);
      Alert.alert(
        'Unable to complete registration',
        getApiErrorMessage(
          error,
          'We could not complete your registration. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    const routes = navigation.getState()?.routes || [];
    if (routes.some((route) => route.name === 'SignUpPhone')) {
      navigation.navigate('SignUpPhone');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Fallback if Register was opened without an auth stack behind it.
    navigation.navigate('AuthChoice');
  };

  return (
    <LinearGradient colors={gradients.primary} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.navBar, isRTL && styles.navBarRtl]}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityRole="button">
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Complete Your Profile</Text>
          <View style={styles.navSpacer} />
        </View>

        <KeyboardAwareScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
        >
          <View style={styles.content}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Telefonak" />
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  ref={firstNameRef}
                  style={styles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={formData.first_name}
                  onChangeText={(text) => handleInputChange('first_name', text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  ref={lastNameRef}
                  style={styles.input}
                  placeholder="Enter your last name"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={formData.last_name}
                  onChangeText={(text) => handleInputChange('last_name', text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Gender *</Text>
                <View style={styles.genderContainer}>
                  {USER_GENDERS.map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderButton,
                        formData.gender === gender && styles.genderButtonActive,
                      ]}
                      onPress={() => handleInputChange('gender', gender)}
                    >
                      <Text
                        style={[
                          styles.genderButtonText,
                          formData.gender === gender &&
                            styles.genderButtonTextActive,
                        ]}
                      >
                        {userGenderLabel(gender, t)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={formData.email}
                  onChangeText={(text) => handleInputChange('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth *</Text>

                <TouchableOpacity
                  style={styles.input}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowDOBPicker(true);
                    setTimeout(() => scrollToDatePicker(), 100);
                  }}
                >
                  <Text
                    style={{
                      color: formData.date_of_birth ? brand.onSurface : 'rgba(255, 255, 255, 0.6)',
                      fontSize: 16,
                    }}
                  >
                    {formData.date_of_birth || 'Select date'}
                  </Text>
                </TouchableOpacity>

                <View
                  ref={datePickerContainerRef}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setDatePickerY(y);
                  }}
                >
                  {showDOBPicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={parsePickerDateYYYYMMDD(formData.date_of_birth)}
                      mode="date"
                      display="default"
                      maximumDate={todayAsPickerDate()}
                      timeZoneName={deviceTimeZoneName()}
                      themeVariant="light"
                      onChange={(event, selectedDate) => {
                        setShowDOBPicker(false);
                        if (event.type === 'set' && selectedDate) {
                          handleInputChange(
                            'date_of_birth',
                            formatPickerDateYYYYMMDD(selectedDate)
                          );
                        }
                      }}
                    />
                  )}

                  {showDOBPicker && Platform.OS === 'ios' && (
                    <View style={styles.iosPickerContainer}>
                      <View style={styles.iosPickerHeader}>
                        <TouchableOpacity onPress={() => setShowDOBPicker(false)}>
                          <Text style={styles.doneText}>Done</Text>
                        </TouchableOpacity>
                      </View>

                      <DateTimePicker
                        value={parsePickerDateYYYYMMDD(formData.date_of_birth)}
                        mode="date"
                        display="spinner"
                        maximumDate={todayAsPickerDate()}
                        timeZoneName={deviceTimeZoneName()}
                        themeVariant="light"
                        textColor="#000"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            handleInputChange(
                              'date_of_birth',
                              formatPickerDateYYYYMMDD(selectedDate)
                            );
                          }
                        }}
                        style={{ backgroundColor: '#fff' }}
                      />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>City *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.citySelector]}
                  activeOpacity={0.7}
                  onPress={() => setCityPickerVisible(true)}
                >
                  <Text
                    style={{
                      color: formData.city ? brand.onSurface : 'rgba(255, 255, 255, 0.6)',
                      fontSize: 16,
                      flex: 1,
                    }}
                  >
                    {formData.city || 'Select city'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>

      <Modal
        visible={cityPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCityPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCityPickerVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select city</Text>
            <FlatList
              data={CITY_OPTIONS}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.cityOption,
                    formData.city === item && styles.cityOptionSelected,
                  ]}
                  onPress={() => {
                    handleInputChange('city', item);
                    setCityPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.cityOptionText,
                      formData.city === item && styles.cityOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  navBarRtl: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  navSpacer: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
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
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radii.xl,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontFamily: fonts.body,
    fontSize: 16,
    color: brand.onSurface,
    borderWidth: 1,
    borderColor: 'rgba(193, 198, 212, 0.2)',
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radii.xl,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  genderButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  genderButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
    color: '#ffffff',
  },
  genderButtonTextActive: {
    color: brand.primary,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: radii.xl,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: fonts.labelBold,
    color: brand.primary,
    fontSize: 18,
  },
  iosPickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: radii.xl,
    marginTop: 10,
    overflow: 'hidden',
  },
  iosPickerHeader: {
    padding: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 0,
  },
  doneText: { fontFamily: fonts.labelBold, fontSize: 16, color: brand.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxHeight: '70%',
    paddingVertical: 12,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1c1c',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cityOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cityOptionSelected: {
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
  },
  cityOptionText: {
    fontSize: 16,
    color: '#1a1c1c',
  },
  cityOptionTextSelected: {
    color: '#1976D2',
    fontWeight: '600',
  },
});
