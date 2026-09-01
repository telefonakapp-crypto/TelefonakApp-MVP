import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { fonts, radii, space } from '../../utils/designTokens';

/**
 * Grouped iOS-style option list used by picker bottom sheets.
 * Presentational only — parent owns selection and data.
 */
export function SelectionList({ children, style }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SelectionListItem({
  label,
  selected = false,
  onPress,
  showDivider = true,
}) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const chevron = isRTL ? 'chevron-back' : 'chevron-forward';

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        showDivider && {
          borderBottomColor: colors.outlineVariant,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.label,
          {
            color: selected ? colors.primary : colors.text,
            textAlign: isRTL ? 'right' : 'left',
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Ionicons name={chevron} size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    gap: space[2],
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    flex: 1,
  },
});
