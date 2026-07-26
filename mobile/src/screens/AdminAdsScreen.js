import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

const API_BASE_URL = 'https://yun-nonerrant-joaquina.ngrok-free.dev/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 220;

export default function AdminAdsScreen() {
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const { t, isRTL } = useLanguage();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    link_url: '',
    is_active: true,
    display_order: 0,
    expires_at: null,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Refs for scrolling to date picker
  const addModalScrollRef = useRef(null);
  const editModalScrollRef = useRef(null);
  const addDatePickerRef = useRef(null);
  const editDatePickerRef = useRef(null);
  const [addDatePickerY, setAddDatePickerY] = useState(0);
  const [editDatePickerY, setEditDatePickerY] = useState(0);

  const fetchAds = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/ads/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setAds(response.data.ads || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
      Alert.alert(t('common.error'), t('admin.failedToFetchAds'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAds();
    }, [fetchAds])
  );

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('admin.permissionNeeded'), t('admin.grantPermissions'));
        return;
      }

      // Calculate aspect ratio to match homepage banner: exactly 220px height
      // Homepage banner: (SCREEN_WIDTH - 32) wide x 220 tall
      // expo-image-picker aspect parameter forces the crop box to this ratio
      // The cropped image will have this exact aspect ratio, matching 220px height when displayed
      const displayWidth = SCREEN_WIDTH - 32; // Full width minus 16px padding on each side
      const displayHeight = BANNER_HEIGHT; // Exactly 220px height - this is the key dimension
      
      // Use the exact pixel dimensions as aspect ratio
      // This ensures the cropper enforces the exact proportions for 220px height
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [displayWidth, displayHeight], // Direct ratio matching 220px height exactly
        quality: 1.0, // Maximum quality
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        try {
          // Upload image to server
          // The image has already been cropped to the correct aspect ratio (matching 220px height)
          const token = await AsyncStorage.getItem('authToken');
          const uploadFormData = new FormData();
          uploadFormData.append('image', {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            name: 'ad-image.jpg',
          });

          const uploadResponse = await axios.post(`${API_BASE_URL}/upload/image`, uploadFormData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          });

          setFormData(prev => ({ ...prev, image_url: uploadResponse.data.image_url }));
          Alert.alert(t('common.success'), t('admin.imageUploaded'));
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert(t('common.error'), error.response?.data?.error || t('admin.failedToUploadImage'));
        } finally {
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('admin.failedToPickImage'));
    }
  };

  const handleCreateAd = async () => {
    if (!formData.title || !formData.image_url) {
      Alert.alert(t('common.error'), t('admin.fillTitleImage'));
      return;
    }

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // For now, we'll use the local URI. In production, you'd upload to a server/CDN
      // and get the URL back
      const adData = {
        title: formData.title,
        image_url: formData.image_url, // In production, this should be the uploaded URL
        link_url: formData.link_url || null,
        is_active: formData.is_active,
        display_order: formData.display_order || 0,
        expires_at: formData.expires_at || null,
      };

      await axios.post(`${API_BASE_URL}/ads`, adData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Alert.alert(t('common.success'), t('admin.adCreated'));
      setShowAddModal(false);
      resetForm();
      fetchAds();
    } catch (error) {
      console.error('Error creating ad:', error);
      Alert.alert(t('common.error'), error.response?.data?.error || t('admin.failedToCreateAd'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAd = async () => {
    if (!formData.title || !formData.image_url) {
      Alert.alert(t('common.error'), t('admin.fillTitleImage'));
      return;
    }

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const adData = {
        title: formData.title,
        image_url: formData.image_url,
        link_url: formData.link_url || null,
        is_active: formData.is_active,
        display_order: formData.display_order || 0,
        expires_at: formData.expires_at || null,
      };

      await axios.put(`${API_BASE_URL}/ads/${selectedAd.id}`, adData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Alert.alert(t('common.success'), t('admin.adUpdated'));
      setShowEditModal(false);
      resetForm();
      fetchAds();
    } catch (error) {
      console.error('Error updating ad:', error);
      Alert.alert(t('common.error'), error.response?.data?.error || t('admin.failedToUpdateAd'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAd = (ad) => {
    Alert.alert(
      t('admin.deleteAd'),
      t('admin.deleteAdConfirm').replace('{title}', ad.title),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.delete(`${API_BASE_URL}/ads/${ad.id}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              Alert.alert(t('common.success'), t('admin.adDeleted'));
              fetchAds();
            } catch (error) {
              console.error('Error deleting ad:', error);
              Alert.alert(t('common.error'), t('admin.failedToDeleteAd'));
            }
          },
        },
      ]
    );
  };

  const handleEditAd = (ad) => {
    setSelectedAd(ad);
    setFormData({
      title: ad.title || '',
      image_url: ad.image_url || '',
      link_url: ad.link_url || '',
      is_active: ad.is_active !== undefined ? ad.is_active : true,
      display_order: ad.display_order || 0,
      expires_at: ad.expires_at ? new Date(ad.expires_at) : null,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      image_url: '',
      link_url: '',
      is_active: true,
      display_order: 0,
      expires_at: null,
    });
    setSelectedAd(null);
  };

  const formatDate = (date) => {
    if (!date) return t('admin.noExpiration');
    return new Date(date).toLocaleDateString();
  };

  const scrollToDatePicker = (isEdit = false) => {
    const scrollRef = isEdit ? editModalScrollRef : addModalScrollRef;
    const yPos = isEdit ? editDatePickerY : addDatePickerY;
    if (scrollRef.current && yPos > 0) {
      scrollRef.current.scrollTo({ y: yPos - 20, animated: true });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('admin.manageAds')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {ads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="image-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('admin.noAdsYet')}</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('admin.createFirstAd')}</Text>
            </View>
          ) : (
            ads.map((ad) => (
              <View key={ad.id} style={[styles.adCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.adCardHeader, getFlexDirection(isRTL, 'row')]}>
                  <View style={styles.adInfo}>
                    <Text style={[styles.adTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{ad.title}</Text>
                    <View style={[styles.adMeta, getFlexDirection(isRTL, 'row')]}>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: ad.is_active ? (isDarkMode ? '#064e3b' : '#dcfce7') : colors.inputBackground },
                        ad.is_active && styles.statusBadgeActive
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: ad.is_active ? colors.success : colors.textSecondary },
                          getTextAlign(isRTL, 'center'),
                        ]}>
                          {ad.is_active ? t('admin.active') : t('common.inactive')}
                        </Text>
                      </View>
                      {ad.expires_at && (
                        <Text style={[styles.expiresText, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
                          {t('admin.expires')}: {formatDate(ad.expires_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.adActions, getFlexDirection(isRTL, 'row')]}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
                      onPress={() => handleEditAd(ad)}
                    >
                      <Ionicons name="pencil" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }]}
                      onPress={() => handleDeleteAd(ad)}
                    >
                      <Ionicons name="trash" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                {ad.image_url && (
                  <Image source={{ uri: ad.image_url }} style={styles.adPreview} resizeMode="cover" />
                )}
                {ad.link_url && (
                  <Text style={[styles.linkText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]} numberOfLines={1}>
                    {t('common.link')}: {ad.link_url}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Ad Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.modalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.createNewAd')}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              ref={addModalScrollRef}
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
            >
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.title')} *</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder={t('admin.adTitle')}
                  placeholderTextColor={colors.textMuted}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.image')} *</Text>
                <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.inputBorder }]} onPress={handlePickImage}>
                  {formData.image_url ? (
                    <Image source={{ uri: formData.image_url }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
                      <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
                      <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('common.tapToSelect')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.linkUrl')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.textMuted}
                  value={formData.link_url}
                  onChangeText={(text) => setFormData({ ...formData, link_url: text })}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.displayOrder')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.display_order.toString()}
                  onChangeText={(text) => setFormData({ ...formData, display_order: parseInt(text) || 0 })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={[styles.switchRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.active')}</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    trackColor={{ false: colors.inputBorder, true: colors.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              <View 
                ref={addDatePickerRef}
                style={styles.formGroup}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setAddDatePickerY(y);
                }}
              >
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.expirationDate')}</Text>
                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                    getFlexDirection(isRTL, 'row'),
                  ]}
                  onPress={() => {
                    setShowDatePicker(true);
                    setTimeout(() => scrollToDatePicker(false), 100);
                  }}
                >
                  <Text style={[styles.datePickerText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {formData.expires_at ? formatDate(formData.expires_at) : t('admin.selectDate')}
                  </Text>
                  <Ionicons name={isRTL ? "calendar-outline" : "calendar-outline"} size={20} color={colors.textSecondary} style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }} />
                </TouchableOpacity>
                {formData.expires_at && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setFormData({ ...formData, expires_at: null })}
                  >
                    <Text style={[styles.clearDateText, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>{t('admin.clearDate')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={formData.expires_at || new Date()}
                  mode="date"
                  display="default"
                  themeVariant={isDarkMode ? 'dark' : 'light'}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && date) {
                      setFormData({ ...formData, expires_at: date });
                    }
                  }}
                />
              )}

              {showDatePicker && Platform.OS === 'ios' && (
                <View style={[styles.iosPickerContainer, { backgroundColor: colors.surface }]}>
                  <View style={[styles.iosPickerHeader, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={[styles.doneText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('common.done')}</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={formData.expires_at || new Date()}
                    mode="date"
                    display="spinner"
                    textColor={colors.text}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    onChange={(event, date) => {
                      if (date) {
                        setFormData({ ...formData, expires_at: date });
                      }
                    }}
                    style={{ backgroundColor: colors.surface }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  uploading && styles.submitButtonDisabled
                ]}
                onPress={handleCreateAd}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={[styles.submitButtonText, getTextAlign(isRTL, 'center')]}>{t('admin.createAd')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Ad Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
              <Text style={[styles.modalTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.editAd')}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              ref={editModalScrollRef}
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
            >
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.title')} *</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder={t('admin.adTitle')}
                  placeholderTextColor={colors.textMuted}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.image')} *</Text>
                <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.inputBorder }]} onPress={handlePickImage}>
                  {formData.image_url ? (
                    <Image source={{ uri: formData.image_url }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
                      <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
                      <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }, getTextAlign(isRTL, 'center')]}>{t('common.tapToSelect')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.linkUrl')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.textMuted}
                  value={formData.link_url}
                  onChangeText={(text) => setFormData({ ...formData, link_url: text })}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.displayOrder')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text, textAlign: isRTL ? 'right' : 'left' }
                  ]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.display_order.toString()}
                  onChangeText={(text) => setFormData({ ...formData, display_order: parseInt(text) || 0 })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={[styles.switchRow, getFlexDirection(isRTL, 'row')]}>
                  <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.active')}</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                    trackColor={{ false: colors.inputBorder, true: colors.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              <View 
                ref={editDatePickerRef}
                style={styles.formGroup}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setEditDatePickerY(y);
                }}
              >
                <Text style={[styles.label, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('admin.expirationDate')}</Text>
                <TouchableOpacity
                  style={[
                    styles.datePickerButton,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                    getFlexDirection(isRTL, 'row'),
                  ]}
                  onPress={() => {
                    setShowDatePicker(true);
                    setTimeout(() => scrollToDatePicker(true), 100);
                  }}
                >
                  <Text style={[styles.datePickerText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
                    {formData.expires_at ? formatDate(formData.expires_at) : t('admin.selectDate')}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }} />
                </TouchableOpacity>
                {formData.expires_at && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setFormData({ ...formData, expires_at: null })}
                  >
                    <Text style={[styles.clearDateText, { color: colors.error }, getTextAlign(isRTL, 'auto')]}>{t('admin.clearDate')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={formData.expires_at || new Date()}
                  mode="date"
                  display="default"
                  themeVariant={isDarkMode ? 'dark' : 'light'}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && date) {
                      setFormData({ ...formData, expires_at: date });
                    }
                  }}
                />
              )}

              {showDatePicker && Platform.OS === 'ios' && (
                <View style={[styles.iosPickerContainer, { backgroundColor: colors.surface }]}>
                  <View style={[styles.iosPickerHeader, { borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={[styles.doneText, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('common.done')}</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={formData.expires_at || new Date()}
                    mode="date"
                    display="spinner"
                    textColor={colors.text}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    onChange={(event, date) => {
                      if (date) {
                        setFormData({ ...formData, expires_at: date });
                      }
                    }}
                    style={{ backgroundColor: colors.surface }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  uploading && styles.submitButtonDisabled
                ]}
                onPress={handleUpdateAd}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={[styles.submitButtonText, getTextAlign(isRTL, 'center')]}>{t('admin.updateAd')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#09090b',
  },
  addButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  adCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adInfo: {
    flex: 1,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  adMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeActive: {},
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {},
  expiresText: {
    fontSize: 12,
  },
  adActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButton: {},
  adPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 12,
  },
  linkText: {
    fontSize: 12,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  modalBodyContent: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  datePickerText: {
    fontSize: 16,
  },
  clearDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 14,
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
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
    overflow: 'hidden',
    marginTop: 8,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderBottomWidth: 1,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

