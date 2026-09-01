import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radii, space, fonts } from '../../utils/designTokens';

/**
 * Soft-touch button — primary / secondary / outline / tertiary / danger.
 */
export function Button({
  children,
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  fullWidth = true,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const text = label ?? (typeof children === 'string' ? children : null);
  const isOutline = variant === 'outline';

  const variantStyles = {
    primary: {
      bg: colors.primary,
      fg: colors.onPrimary,
    },
    secondary: {
      bg: colors.secondaryContainer,
      fg: colors.text,
    },
    outline: {
      bg: 'transparent',
      fg: colors.text,
    },
    tertiary: {
      bg: 'transparent',
      fg: colors.primary,
    },
    danger: {
      bg: colors.error,
      fg: colors.onPrimary,
    },
  }[variant] || {
    bg: colors.primary,
    fg: colors.onPrimary,
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || text || undefined}
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        { backgroundColor: variantStyles.bg },
        isOutline && {
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface || 'transparent',
        },
        variant === 'tertiary' && styles.tertiaryPad,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.fg} />
      ) : (
        <View style={styles.content}>
          {text ? (
            <Text style={[styles.label, { color: variantStyles.fg }, textStyle]}>
              {text}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.xl,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  tertiaryPad: {
    paddingHorizontal: space[3],
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  label: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
  },
});
