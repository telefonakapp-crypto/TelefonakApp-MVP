import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients } from '../utils/designTokens';

const SPLASH_MARK = require('../../assets/telefonak-splash-phone-t.png');
const WORDMARK = require('../../assets/telefonak-word-mark-small.png');
const WORDMARK_ASPECT = 1155 / 225;

function SplashScreenContent({ fontReady = false }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  const iconSize = Math.min(
    168,
    Math.round(screenWidth * 0.38),
    Math.round(screenHeight * 0.22),
  );
  const baseWordmarkWidth = Math.min(300, Math.round(screenWidth * 0.68));
  const wordmarkWidth = Math.round(baseWordmarkWidth * (1155 / 1350));
  const wordmarkHeight = Math.round(wordmarkWidth / WORDMARK_ASPECT);
  const bottomPad = Math.max(insets.bottom, 8) + 28;

  return (
    <LinearGradient
      colors={gradients.primary}
      style={styles.container}
    >
      <View style={styles.iconStage} pointerEvents="none">
        <Animated.Image
          source={SPLASH_MARK}
          accessibilityLabel="Telefonak"
          resizeMode="contain"
          style={{
            width: iconSize,
            height: iconSize,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.wordmarkDock, { paddingBottom: bottomPad }]}
      >
        <Animated.Image
          source={WORDMARK}
          accessibilityLabel="Telefonak"
          resizeMode="contain"
          style={{
            width: wordmarkWidth,
            height: wordmarkHeight,
            opacity: logoOpacity,
          }}
        />
      </View>
    </LinearGradient>
  );
}

export default function SplashScreen(props) {
  return (
    <SafeAreaProvider>
      <SplashScreenContent {...props} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
