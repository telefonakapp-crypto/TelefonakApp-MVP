import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection } from '../../utils/rtlStyles';
import { fonts, radii, space } from '../../utils/designTokens';

export const ownerActionListStyle = { gap: 10 };

/**
 * Compact manage-listing action row used on Listing Details and My Listings.
 */
export function OwnerActionRow({
  icon,
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'neutral',
}) {
  const { colors, isDarkMode } = useTheme();
  const { isRTL } = useLanguage();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const backgroundColor = isPrimary
    ? colors.primary
    : isDanger
      ? isDarkMode
        ? 'rgba(239, 68, 68, 0.16)'
        : 'rgba(239, 68, 68, 0.10)'
      : colors.surfaceContainerLow;
  const foregroundColor = isPrimary
    ? colors.onPrimary
    : isDanger
      ? colors.error
      : colors.text;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor },
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <View style={[styles.inner, getFlexDirection(isRTL, 'row')]}>
          <Ionicons name={icon} size={18} color={foregroundColor} />
          <Text style={[styles.label, { color: foregroundColor }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 50,
    borderRadius: radii['2xl'],
    paddingHorizontal: space[4],
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
    lineHeight: 22,
  },
  disabled: {
    opacity: 0.55,
  },
});
