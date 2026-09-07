import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

function TelefonakAddIcon({ color = '#ffffff' }) {
  return (
    <View style={styles.icon} pointerEvents="none">
      <View style={[styles.horizontalStroke, { backgroundColor: color }]} />
      <View style={[styles.verticalStroke, { backgroundColor: color }]} />
    </View>
  );
}

export default function SellPhoneButton({
  onPress,
  style,
  accessibilityLabel = 'Sell phone',
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    scale.stopAnimation();
    highlightOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(highlightOpacity, {
        toValue: 0.08,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlightOpacity, scale]);

  const handlePressOut = useCallback(() => {
    scale.stopAnimation();
    highlightOpacity.stopAnimation();
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 420,
        damping: 28,
        mass: 0.55,
        useNativeDriver: true,
      }),
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlightOpacity, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
      >
        <TelefonakAddIcon />
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, { opacity: highlightOpacity }]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  horizontalStroke: {
    position: 'absolute',
    width: 18,
    height: 2.5,
    left: 0,
    top: 7.75,
    borderRadius: 1.25,
  },
  verticalStroke: {
    position: 'absolute',
    width: 2.5,
    height: 18,
    left: 7.75,
    top: 0,
    borderRadius: 1.25,
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
});
