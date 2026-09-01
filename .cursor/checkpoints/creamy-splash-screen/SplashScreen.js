import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_ICON = require('../../assets/telefonak-app-icon-v5.png');
const WORDMARK = require('../../assets/telefonak-word-mark-white-bg-bigger-curved.png');
const WORDMARK_ASPECT = 1350 / 257;

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
  const wordmarkWidth = Math.min(300, Math.round(screenWidth * 0.68));
  const wordmarkHeight = Math.round(wordmarkWidth / WORDMARK_ASPECT);
  const bottomPad = Math.max(insets.bottom, 8) + 28;

  return (
    <View style={styles.container}>
      <View style={styles.iconStage} pointerEvents="none">
        <Animated.Image
          source={APP_ICON}
          accessibilityLabel="Telefonak"
          resizeMode="contain"
          style={[
            styles.appIcon,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: Math.round(iconSize * 0.223),
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.wordmarkDock, { paddingBottom: bottomPad }]}
      >
        <View
          style={[
            styles.wordmarkClip,
            { width: wordmarkWidth, height: wordmarkHeight },
          ]}
        >
          <Animated.Image
            source={WORDMARK}
            accessibilityLabel="Telefonak"
            resizeMode="contain"
            style={{
              width: wordmarkWidth,
              height: wordmarkWidth,
              marginTop: -Math.round((wordmarkWidth - wordmarkHeight) / 2),
              opacity: logoOpacity,
            }}
          />
        </View>
      </View>
    </View>
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
    backgroundColor: '#F3F2EF',
  },
  iconStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    overflow: 'hidden',
  },
  wordmarkDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  wordmarkClip: {
    overflow: 'hidden',
    alignItems: 'center',
  },
});
