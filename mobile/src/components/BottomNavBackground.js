import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function BottomNavBackground({ color, style }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.container, { backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
