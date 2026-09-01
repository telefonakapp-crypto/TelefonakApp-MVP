import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { fonts, radii, space, ambientElevation } from '../../utils/designTokens';

const getImageUri = (image) =>
  typeof image === 'string' ? image : image?.uri || '';

export default function CreateListingImages({ images, onPick, onRemove, onMove }) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {t('createListing.images')}
        <Text style={styles.requiredAsterisk}> *</Text>
      </Text>
      <TouchableOpacity
        style={[
          styles.uploadCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          ambientElevation,
        ]}
        onPress={onPick}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.uploadIcon,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.uploadTitle, { color: colors.text }]}>
          {t('createListing.uploadPhotos') || 'Upload photos'}
        </Text>
        <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>
          {t('createListing.addUpTo10Images')}
        </Text>
      </TouchableOpacity>

      {images.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imageScroll}
          contentContainerStyle={isRTL ? { flexDirection: 'row-reverse' } : null}
        >
          {images.map((asset, index) => (
            <View
              key={`${getImageUri(asset)}-${index}`}
              style={[
                styles.imageContainer,
                {
                  marginRight: isRTL ? 0 : 12,
                  marginLeft: isRTL ? 12 : 0,
                },
              ]}
            >
              <Image source={{ uri: getImageUri(asset) }} style={styles.imagePreview} />
              <TouchableOpacity
                style={[styles.removeImageButton, { backgroundColor: colors.surface }]}
                onPress={() => onRemove(index)}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
              {images.length > 1 ? (
                <View style={styles.imageReorder}>
                  <TouchableOpacity
                    onPress={() => onMove(index, -1)}
                    disabled={index === 0}
                    hitSlop={8}
                    style={[
                      styles.reorderBtn,
                      { backgroundColor: colors.surface, opacity: index === 0 ? 0.35 : 1 },
                    ]}
                  >
                    <Ionicons
                      name={isRTL ? 'chevron-forward' : 'chevron-back'}
                      size={14}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onMove(index, 1)}
                    disabled={index === images.length - 1}
                    hitSlop={8}
                    style={[
                      styles.reorderBtn,
                      {
                        backgroundColor: colors.surface,
                        opacity: index === images.length - 1 ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={14}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  requiredAsterisk: {
    color: '#E53935',
  },
  uploadCard: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: space[6],
    paddingHorizontal: space[4],
    alignItems: 'center',
    gap: space[2],
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  uploadTitle: { fontFamily: fonts.headline, fontSize: 16 },
  uploadHint: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  imageScroll: { marginTop: space[4] },
  imageContainer: { position: 'relative' },
  imagePreview: { width: 96, height: 96, borderRadius: radii.xl },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 12,
  },
  imageReorder: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reorderBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
