import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * Consistent Ionicons touch target (min 44×44).
 */
export function IconButton({
  name,
  size = 22,
  color,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || name}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      <Ionicons name={name} size={size} color={color || colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
