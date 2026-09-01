import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../utils/designTokens';

/**
 * Small red count badge used on the notification bell and Offers tab.
 * Matches the existing Home header notification badge styling.
 */
export default function NavBadge({ count, color = '#ef4444', style }) {
  const value = Number(count) || 0;
  if (value <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: color }, style]}>
      <Text style={styles.text}>{value > 99 ? '99+' : String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  text: {
    fontFamily: fonts.labelBold,
    color: '#ffffff',
    fontSize: 10,
  },
});
