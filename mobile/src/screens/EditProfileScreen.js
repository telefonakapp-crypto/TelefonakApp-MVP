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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { getApiErrorMessage, logApiError } from '../utils/apiError';
import apiClient from '../utils/api';
import { ignoreIfMaintenance } from '../utils/maintenance';
import {
  formatPickerDateYYYYMMDD,
  parsePickerDateYYYYMMDD,
  toCalendarDateYYYYMMDD,
  todayAsPickerDate,
  deviceTimeZoneName,
} from '../utils/dateUtils';
import { fonts, radii, space, ambientElevation } from '../utils/designTokens';
import { FormScreenSkeleton, IconButton, Skeleton } from '../components/ui';

function textOrFallback(value, fallback) {
  return value && !value.includes('.') ? value : fallback;
}

function FieldLabel({ children, colors, isRTL, required = false }) {
  return (
    <Text style={[styles.label, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
      {children}
      {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
    </Text>
  );
}

function ProfileField({ label, children, colors, isRTL, required = false }) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel colors={colors} isRTL={isRTL} required={required}>
        {label}
      </FieldLabel>
      {children}
    </View>
  );
}

function ProfileActionRow({ icon, label, onPress, colors, isRTL }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, getFlexDirection(isRTL, 'row')]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.actionIcon,
          {
            backgroundColor: colors.surfaceContainerLow,
            marginRight: isRTL ? 0 : space[3],
            marginLeft: isRTL ? space[3] : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
        {label}
      </Text>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
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
      const response = await apiClient.get('/user/profile');

      const user = response.data.user;
      
      const formattedDateOfBirth = toCalendarDateYYYYMMDD(user.date_of_birth);
      
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        gender: user.gender || '',
        email: user.email || '',
        date_of_birth: formattedDateOfBirth,
        city: user.city || '',
      });
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const tr = (key, fallback) => textOrFallback(t(key), fallback);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      handleInputChange('date_of_birth', formatPickerDateYYYYMMDD(selectedDate));
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
      await apiClient.put('/user/profile', formData);

      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      if (ignoreIfMaintenance(error)) return;
      logApiError('EditProfileScreen.updateProfile', error);
      Alert.alert(
        'Error',
        getApiErrorMessage(error, 'Failed to update profile')
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
          <IconButton
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            onPress={() => navigation.goBack()}
            accessibilityLabel={tr('common.back', 'Back')}
          />
          <Skeleton width={104} height={18} />
          <View style={styles.headerSpacer} />
        </View>
        <FormScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, getFlexDirection(isRTL, 'row')]}>
        <IconButton
          name={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={() => navigation.goBack()}
          accessibilityLabel={tr('common.back', 'Back')}
        />
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
          {tr('settings.editProfile', 'Edit Profile')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.profileSection}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceContainerLow }]}>
            <Ionicons name="person" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.profileName, { color: colors.text }, getTextAlign(isRTL, 'center')]}>
            {`${formData.first_name} ${formData.last_name}`.trim() || tr('profile.userProfile', 'User Profile')}
          </Text>
        </View>

        <View style={[styles.actionCard, { backgroundColor: colors.card }, ambientElevation]}>
          <ProfileActionRow
            icon="call-outline"
            label={tr('profile.changePhoneNumber', 'Change Phone Number')}
            onPress={() => navigation.navigate('ChangePhone')}
            colors={colors}
            isRTL={isRTL}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
            {tr('settings.editProfile', 'Edit Profile')}
          </Text>
          <View style={[styles.formCard, { backgroundColor: colors.card }, ambientElevation]}>
            <ProfileField label={tr('register.firstName', 'First Name')} colors={colors} isRTL={isRTL} required>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder="Enter your first name"
              placeholderTextColor={colors.textSecondary}
              value={formData.first_name}
              onChangeText={(text) => handleInputChange('first_name', text)}
            />
            </ProfileField>

            <ProfileField label={tr('register.lastName', 'Last Name')} colors={colors} isRTL={isRTL} required>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder="Enter your last name"
              placeholderTextColor={colors.textSecondary}
              value={formData.last_name}
              onChangeText={(text) => handleInputChange('last_name', text)}
            />
            </ProfileField>

            <ProfileField label={tr('register.email', 'Email')} colors={colors} isRTL={isRTL}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            </ProfileField>

            <ProfileField label={tr('register.dateOfBirth', 'Date of Birth')} colors={colors} isRTL={isRTL}>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                },
                getFlexDirection(isRTL, 'row'),
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dateText, { color: formData.date_of_birth ? colors.text : colors.textSecondary }]}>
                {formData.date_of_birth || 'Select date of birth'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={parsePickerDateYYYYMMDD(formData.date_of_birth)}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={todayAsPickerDate()}
                timeZoneName={deviceTimeZoneName()}
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
                  value={parsePickerDateYYYYMMDD(formData.date_of_birth)}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={todayAsPickerDate()}
                  timeZoneName={deviceTimeZoneName()}
                  textColor={colors.text}
                  style={{ backgroundColor: colors.surface }}
                />
              </View>
            )}
            </ProfileField>

            <ProfileField label={tr('register.city', 'City')} colors={colors} isRTL={isRTL}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder="Enter your city"
              placeholderTextColor={colors.textSecondary}
              value={formData.city}
              onChangeText={(text) => handleInputChange('city', text)}
            />
            </ProfileField>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>Save Changes</Text>
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
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 18,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: space[6],
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space[4],
  },
  profileName: {
    fontFamily: fonts.headline,
    fontSize: 22,
  },
  section: {
    marginBottom: space[5],
  },
  sectionTitle: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: space[2],
    marginHorizontal: space[1],
  },
  formCard: {
    borderRadius: radii['2xl'] + 4,
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[1],
    marginBottom: space[3],
  },
  fieldGroup: {
    marginBottom: space[4],
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  requiredAsterisk: {
    color: '#E53935',
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontFamily: fonts.body,
    fontSize: 16,
  },
  dateInput: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  dateText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  actionCard: {
    borderRadius: radii['2xl'] + 4,
    overflow: 'hidden',
    paddingVertical: space[1],
    marginBottom: space[3],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  submitButton: {
    minHeight: 56,
    borderRadius: radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
    marginBottom: space[4],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
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

