import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, space } from '../../utils/designTokens';

export function SectionHeader({ title, actionLabel, onAction, style }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.7}>
          <Text style={[styles.action, { color: colors.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    marginBottom: space[3],
  },
  title: {
    fontFamily: fonts.headline,
    fontSize: 18,
    flex: 1,
  },
  action: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
  },
});
