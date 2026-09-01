import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, radii, space } from '../../utils/designTokens';

/**
 * Filter / selection pill.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  style,
  disabled = false,
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      activeOpacity={0.8}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceContainerLow,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? colors.onPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.full,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
  },
});
