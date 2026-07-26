import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    email: '',
    date_of_birth: '',
    city: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = response.data.user;
      
      // Format date_of_birth to show only date (YYYY-MM-DD) without time
      let formattedDateOfBirth = '';
      if (user.date_of_birth) {
        const date = new Date(user.date_of_birth);
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD
          formattedDateOfBirth = date.toISOString().split('T')[0];
        } else {
          // If it's already in YYYY-MM-DD format, use it directly
          formattedDateOfBirth = user.date_of_birth.split('T')[0];
        }
      }
      
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        gender: user.gender || '',
        email: user.email || '',
        date_of_birth: formattedDateOfBirth,
        city: user.city || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      handleInputChange('date_of_birth', formattedDate);
    } else if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.put(
        `${API_BASE_URL}/user/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update profile'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>First Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter your first name"
              placeholderTextColor={colors.textSecondary}
              value={formData.first_name}
              onChangeText={(text) => handleInputChange('first_name', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Last Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter your last name"
              placeholderTextColor={colors.textSecondary}
              value={formData.last_name}
              onChangeText={(text) => handleInputChange('last_name', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
            <View style={styles.pickerContainer}>
              {['male', 'female', 'other'].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: formData.gender === gender ? colors.primary : colors.surface, borderColor: formData.gender === gender ? colors.primary : colors.inputBorder },
                  ]}
                  onPress={() => handleInputChange('gender', gender)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: formData.gender === gender ? '#ffffff' : colors.text },
                    ]}
                  >
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Date of Birth</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateText, { color: formData.date_of_birth ? colors.text : colors.textSecondary }]}>
                {formData.date_of_birth || 'Select date of birth'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={formData.date_of_birth ? new Date(formData.date_of_birth) : new Date(2000, 0, 1)}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={[styles.iosPickerContainer, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}>
                <View style={[styles.iosPickerHeader, { borderBottomColor: colors.borderLight }]}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={formData.date_of_birth ? new Date(formData.date_of_birth) : new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor={colors.text}
                  style={{ backgroundColor: colors.surface }}
                />
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>City</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter your city"
              placeholderTextColor={colors.textSecondary}
              value={formData.city}
              onChangeText={(text) => handleInputChange('city', text)}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  contentContainer: {
    padding: 16,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
  },
  placeholderText: {
    // Color handled inline
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  pickerOptionActive: {
    // Handled inline
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    // Handled inline
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  iosPickerContainer: {
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  iosPickerHeader: {
    padding: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

