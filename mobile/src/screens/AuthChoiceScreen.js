import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, ambientElevation, brand, gradients } from '../utils/designTokens';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection } from '../utils/rtlStyles';

const LOGO = require('../../assets/telefonak-app-icon-v5.png');

export default function AuthChoiceScreen() {
  const navigation = useNavigation();
  const { t, isRTL, language, changeLanguage } = useLanguage();
  const flip = useRef(new Animated.Value(0)).current;
  const flipBusyRef = useRef(false);

  const handleSelectLanguage = (nextLanguage) => {
    if (nextLanguage === language || flipBusyRef.current) return;
    flipBusyRef.current = true;
    const dir = nextLanguage === 'ar' ? 1 : -1;
    Animated.timing(flip, {
      toValue: dir,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        flip.setValue(0);
        flipBusyRef.current = false;
        return;
      }
      changeLanguage(nextLanguage);
      flip.setValue(-dir);
      Animated.timing(flip, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        flipBusyRef.current = false;
      });
    });
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleSignUp = () => {
    navigation.navigate('SignUpPhone');
  };

  const flipRotateY = flip.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const flipOpacity = flip.interpolate({
    inputRange: [-1, -0.2, 0, 0.2, 1],
    outputRange: [0.35, 1, 1, 1, 0.35],
  });

  return (
    <LinearGradient
      colors={gradients.primary}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.languageBar} pointerEvents="box-none">
          <View style={styles.languageTrack} pointerEvents="auto">
            <TouchableOpacity
              onPress={() => handleSelectLanguage('en')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'en' }}
              style={[
                styles.languageSegment,
                language === 'en' && styles.languageSegmentSelected,
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.languageSegmentText,
                  language === 'en' && styles.languageSegmentTextSelected,
                ]}
              >
                {t('welcome.languageEnglish')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSelectLanguage('ar')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'ar' }}
              style={[
                styles.languageSegment,
                language === 'ar' && styles.languageSegmentSelected,
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.languageSegmentText,
                  language === 'ar' && styles.languageSegmentTextSelected,
                ]}
              >
                {t('welcome.languageArabic')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          collapsable={false}
          pointerEvents="box-none"
          style={[
            styles.flipSurface,
            {
              opacity: flipOpacity,
              transform: [{ perspective: 1000 }, { rotateY: flipRotateY }],
            },
          ]}
        >
          <View style={styles.upper} pointerEvents="none">
            <Image
              source={LOGO}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="Telefonak"
            />
          </View>

          <View style={styles.lower}>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
                  style={[styles.buttonGradient, getFlexDirection(isRTL, 'row')]}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={24}
                    color={brand.primary}
                    style={[
                      styles.buttonIcon,
                      isRTL ? { marginRight: 0, marginLeft: 12 } : null,
                    ]}
                  />
                  <Text style={styles.loginButtonText}>{t('welcome.haveAccount')}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signupButton}
                onPress={handleSignUp}
                activeOpacity={0.8}
              >
                <View style={[styles.signupButtonContent, getFlexDirection(isRTL, 'row')]}>
                  <Ionicons
                    name="person-add-outline"
                    size={24}
                    color="#fff"
                    style={[
                      styles.buttonIcon,
                      isRTL ? { marginRight: 0, marginLeft: 12 } : null,
                    ]}
                  />
                  <Text style={styles.signupButtonText}>{t('welcome.signUp')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('welcome.terms')}</Text>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flipSurface: {
    flex: 1,
    backfaceVisibility: 'hidden',
  },
  languageBar: {
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingRight: 16,
    transform: [{ translateY: 30 }],
    zIndex: 2,
    elevation: 3,
  },
  languageTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  languageSegment: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  languageSegmentSelected: {
    backgroundColor: brand.primary,
  },
  languageSegmentText: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: '#1a1c1c',
    textDecorationLine: 'none',
  },
  languageSegmentTextSelected: {
    color: '#ffffff',
    fontFamily: fonts.labelBold,
    textDecorationLine: 'none',
  },
  upper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoImage: {
    width: 176,
    height: 176,
    borderRadius: 36,
  },
  lower: {
    paddingHorizontal: 30,
    paddingBottom: 12,
  },
  buttonsContainer: {
    width: '100%',
    gap: 14,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    ...ambientElevation,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  signupButton: {
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  signupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 12,
  },
  loginButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 18,
    color: brand.primary,
  },
  signupButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 18,
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 8,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 18,
  },
});
