import React from 'react';
import { View, StyleSheet } from 'react-native';
import { space as spaceScale } from '../../utils/designTokens';

/**
 * Vertical (or horizontal) stack with consistent gap from the spacing scale.
 * gapKey: 1–20 keys from designTokens.space (default 4 → 16)
 */
export function Stack({
  children,
  gap = 4,
  horizontal = false,
  style,
}) {
  const gapValue =
    typeof gap === 'number' && spaceScale[gap] != null ? spaceScale[gap] : gap;

  return (
    <View
      style={[
        horizontal ? styles.row : styles.col,
        { gap: gapValue },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
