import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Logo animation
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

    // Text animation with delay
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);
  }, []);

  const logoAnimatedStyle = {
    opacity: logoOpacity,
    transform: [{ scale: logoScale }],
  };

  const textAnimatedStyle = {
    opacity: textOpacity,
    transform: [{ translateY: textTranslateY }],
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          {/* Replace with actual logo image when available */}
          {/* <Image
            source={require('@assets/generated_images/telefonak_app_logo_abstract_smartphone_smile.png')}
            style={styles.logoImage}
            resizeMode="contain"
          /> */}
          <Text style={styles.logoPlaceholder}>📱</Text>
        </Animated.View>
        <Animated.Text style={[styles.appName, textAnimatedStyle]}>
          Telefonak
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 128, // w-32
    height: 128, // h-32
    backgroundColor: '#ffffff',
    borderRadius: 24, // rounded-3xl
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16, // p-4
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24, // gap-6 equivalent
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    fontSize: 80,
    textAlign: 'center',
  },
  appName: {
    fontSize: 36, // text-4xl
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5, // tracking-tight
  },
});
