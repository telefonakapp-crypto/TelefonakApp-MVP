import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, space } from '../../utils/designTokens';
import { Button } from './Button';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconRing, { backgroundColor: colors.surfaceContainerLow }]}>
        <Ionicons name={icon} size={32} color={colors.textSecondary} />
      </View>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[8],
    paddingHorizontal: space[5],
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4],
  },
  title: {
    fontFamily: fonts.headline,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: space[2],
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: {
    marginTop: space[5],
    paddingHorizontal: space[6],
  },
});
