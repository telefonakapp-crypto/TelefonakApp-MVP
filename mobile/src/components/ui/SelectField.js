import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { fonts, radii, space } from '../../utils/designTokens';

/**
 * Select trigger matching TextField visuals.
 * Parent owns modal/sheet; pass onPress to open it.
 */
export function SelectField({
  label,
  required = false,
  value,
  placeholder = 'Select…',
  onPress,
  error,
  disabled = false,
  style,
}) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const display = value || placeholder;
  const isPlaceholder = !value;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text
          style={[
            styles.label,
            { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {label}
          {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.field,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.error : colors.inputBorder,
            opacity: disabled ? 0.55 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: isPlaceholder ? colors.textMuted : colors.text,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  requiredAsterisk: {
    color: '#E53935',
  },
  field: {
    minHeight: 56,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: 16,
    flex: 1,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space[1],
  },
});
