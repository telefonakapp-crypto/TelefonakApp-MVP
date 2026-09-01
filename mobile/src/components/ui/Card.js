import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ambientElevation, radii, space } from '../../utils/designTokens';

/**
 * Tonal card — white/surface-lowest on page background; ambient elevation.
 * No hard borders by default (no-line rule).
 */
export function Card({ children, style, elevated = true, padded = true }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.card,
        },
        elevated && ambientElevation,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii['2xl'] + 4,
    overflow: 'hidden',
  },
  padded: {
    padding: space[5],
  },
});
