import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, radii, space, statusColors } from '../../utils/designTokens';

const FALLBACK = '#7a848c';
const DARK_STATUS_COLORS = {
  pending: '#fbbf24',
  approved: '#4ade80',
  declined: '#f87171',
  sold: '#cbd5e1',
  resubmitted: '#60a5fa',
  updated: '#818cf8',
  deleted: '#a8b0b6',
  hidden: '#a78bfa',
};

/**
 * Listing / offer status pill — soft tonal, not neon.
 * status: pending | approved | declined | sold | resubmitted | updated | deleted | hidden | custom
 */
export function StatusBadge({ status, label, style, textStyle }) {
  const { statusColors: themeStatus, isDarkMode } = useTheme();
  const key = String(status || '').toLowerCase();
  const accent = isDarkMode
    ? DARK_STATUS_COLORS[key] || '#a8b0b6'
    : (themeStatus && themeStatus[key]) || statusColors[key] || FALLBACK;
  const text = label || (status ? String(status) : '');

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${accent}${isDarkMode ? '26' : '14'}` },
        style,
      ]}
    >
      <Text style={[styles.text, { color: accent }, textStyle]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[3] + 2,
    paddingVertical: space[2],
    borderRadius: radii.xl,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
});
