import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

// Pending gray, accepted green, rejected red, withdrawn neutral.
const STATUS_COLORS = {
  pending: '#6b7280',
  accepted: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#a1a1aa',
};

export const offerStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.withdrawn;

export default function OfferStatusBadge({ status, style }) {
  const { t } = useLanguage();
  const color = offerStatusColor(status);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }, style]}>
      <Text style={[styles.text, { color }]}>{t(`offers.status.${status}`) || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
