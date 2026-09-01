import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { fonts, radii, space } from '../utils/designTokens';

// Pending yellow, accepted green, rejected red, withdrawn/cancelled gray.
const STATUS_COLORS = {
  pending: '#ca8a04',
  accepted: '#266931',
  rejected: '#ef4444',
  withdrawn: '#71717a',
};
const DARK_STATUS_COLORS = {
  pending: '#fbbf24',
  accepted: '#4ade80',
  rejected: '#f87171',
  withdrawn: '#a8b0b6',
};

export const offerStatusColor = (status, isDarkMode = false) =>
  (isDarkMode ? DARK_STATUS_COLORS : STATUS_COLORS)[status] ||
  (isDarkMode ? DARK_STATUS_COLORS.withdrawn : STATUS_COLORS.withdrawn);

export default function OfferStatusBadge({ status, style }) {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const color = offerStatusColor(status, isDarkMode);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}${isDarkMode ? '26' : '14'}` },
        style,
      ]}
    >
      <Text style={[styles.text, { color }]}>{t(`offers.status.${status}`) || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space[3],
    paddingVertical: space[1] + 1,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
});
