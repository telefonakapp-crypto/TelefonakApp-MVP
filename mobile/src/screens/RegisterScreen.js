import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DropDownPicker from 'react-native-dropdown-picker';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import apiClient from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const isValidEmail = (email) => {
  const regex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    email: '',
    date_of_birth: '',
    city: '',
  });
  const [cityOpen, setCityOpen] = useState(false);
const [cityValue, setCityValue] = useState(null);

const [cityItems, setCityItems] = useState([
  { label: 'Amman', value: 'Amman' },
  { label: 'Irbid', value: 'Irbid' },
  { label: 'Zarqa', value: 'Zarqa' },
  { label: 'Balqa', value: 'Balqa' },
  { label: 'Madaba', value: 'Madaba' },
  { label: 'Karak', value: 'Karak' },
  { label: 'Tafilah', value: 'Tafilah' },
  { label: "Ma'an", value: "Ma'an" },
  { label: 'Aqaba', value: 'Aqaba' },
  { label: 'Jerash', value: 'Jerash' },
  { label: 'Ajloun', value: 'Ajloun' },
  { label: 'Mafraq', value: 'Mafraq' },
]);


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
  const { token } = route.params || {};

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const scrollToDatePicker = () => {
    if (scrollViewRef.current && datePickerY > 0) {
      try {
        // KeyboardAwareScrollView uses scrollToPosition for scrolling
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
    // Validation
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
      const response = await apiClient.post(
        '/user/register',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data) {
        await AsyncStorage.setItem('authToken', response.data.token);
        // Always go to Home - admins can access AdminDashboard from Profile
        // Reset navigation stack to prevent going back to OTP/Login/Register
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
      }
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.[0]?.msg || 
                          error.message || 
                          'Failed to register. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <KeyboardAwareScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
          >
          <View style={styles.content}>
            <Text style={styles.logo}>👤</Text>
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
                  {['male', 'female', 'other'].map((gender) => (
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
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
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
                      color: formData.date_of_birth ? '#fff' : 'rgba(255, 255, 255, 0.6)',
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
                      value={
                        formData.date_of_birth
                          ? new Date(formData.date_of_birth)
                          : new Date(2000, 0, 1)
                      }
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      themeVariant="light"
                      onChange={(event, selectedDate) => {
                        setShowDOBPicker(false);
                        if (event.type === 'set' && selectedDate) {
                          handleInputChange(
                            'date_of_birth',
                            selectedDate.toISOString().split('T')[0]
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
                        value={
                          formData.date_of_birth
                            ? new Date(formData.date_of_birth)
                            : new Date(2000, 0, 1)
                        }
                        mode="date"
                        display="spinner"
                        maximumDate={new Date()}
                        themeVariant="light"
                        textColor="#000"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            handleInputChange(
                              'date_of_birth',
                              selectedDate.toISOString().split('T')[0]
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

                <DropDownPicker
                open={cityOpen}
                value={cityValue}
                items={cityItems}
                setOpen={setCityOpen}
                setValue={(callback) => {
                  const value = callback(cityValue);
                  setCityValue(value);
                  handleInputChange('city', value || '');
                }}
                setItems={setCityItems}
                placeholder="Select city"

                listMode="SCROLLVIEW"
                maxHeight={200}

                style={styles.dropdown}                 
                dropDownContainerStyle={styles.dropdownContainer}

                textStyle={{
                  color: '#000',                        
                  fontSize: 16,
                }}

                labelStyle={{
                  color: '#fff',                        
                }}

                selectedItemContainerStyle={{
                  backgroundColor: '#fff',              
                }}

                selectedItemLabelStyle={{
                  color: '#000',
                  fontWeight: '600',
                }}

                placeholderStyle={{
                  color: '#555',
                }}

                zIndex={3000}
                zIndexInverse={1000}
              />


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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
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
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
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
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: '#667eea',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iosPickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
  },
  
  iosPickerHeader: {
    padding: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  
  doneText: { fontSize: 16, fontWeight: '600', color: '#667eea' },

  dropdown: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // default (like inputs)
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    minHeight: 55,
  },
  
  dropdownContainer: {
    backgroundColor: '#fff', // ✅ white list
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
  },
});

