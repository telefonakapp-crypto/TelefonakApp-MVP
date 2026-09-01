import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fonts as tokenFonts,
  radii as tokenRadii,
  space as tokenSpace,
  type as tokenType,
  gradients as tokenGradients,
  ambientElevation,
  statusColors,
  brand,
} from '../utils/designTokens';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/** Re-export static tokens for convenience */
export const fonts = tokenFonts;
export const radii = tokenRadii;
export const space = tokenSpace;
export const type = tokenType;
export const gradients = tokenGradients;

const lightColors = {
  background: '#f9f9f9',
  surfaceContainerLow: '#f3f3f3',
  surfaceContainer: '#eeeeee',
  surface: '#ffffff',
  card: '#ffffff',

  text: '#1a1c1c',
  textSecondary: '#526069',
  textMuted: '#7a848c',

  border: 'rgba(193, 198, 212, 0.2)',
  borderLight: 'rgba(193, 198, 212, 0.12)',
  outlineVariant: '#c1c6d4',

  // Telefonak brand primary
  primary: brand.primary,
  primaryDark: brand.primaryPressed,
  primaryContainer: brand.primaryContainer,
  primaryDeep: brand.primaryDeep,
  onPrimary: brand.onPrimary,
  focusAura: brand.focusAura,

  accent: brand.primary,
  error: brand.error,
  success: brand.success,
  successSoft: brand.successSoft,
  warning: brand.warning,

  overlay: 'rgba(26, 28, 28, 0.4)',
  shadow: brand.ambientShadow,

  inputBackground: '#ffffff',
  inputBorder: 'rgba(193, 198, 212, 0.2)',

  secondaryContainer: '#eeeeee',
};

const darkColors = {
  background: '#121414',
  surfaceContainerLow: '#1a1c1c',
  surfaceContainer: '#222525',
  surface: '#1e2121',
  card: '#1e2121',

  text: '#f2f4f4',
  textSecondary: '#a8b0b6',
  textMuted: '#7a848c',

  border: 'rgba(193, 198, 212, 0.18)',
  borderLight: 'rgba(193, 198, 212, 0.1)',
  outlineVariant: '#c1c6d4',

  primary: '#42A5F5',
  primaryDark: brand.primary,
  primaryContainer: brand.primary,
  primaryDeep: brand.primaryDeep,
  onPrimary: '#ffffff',
  focusAura: 'rgba(66, 165, 245, 0.15)',

  accent: '#42A5F5',
  error: '#f87171',
  success: '#4ade80',
  successSoft: 'rgba(171, 244, 172, 0.25)',
  warning: '#fbbf24',

  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: 'rgba(26, 28, 28, 0.35)',

  inputBackground: '#1e2121',
  inputBorder: 'rgba(193, 198, 212, 0.18)',

  secondaryContainer: '#222525',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          setIsDarkMode(false);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        setIsDarkMode(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('themeMode', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  const value = {
    isDarkMode,
    colors,
    fonts: tokenFonts,
    radii: tokenRadii,
    space: tokenSpace,
    type: tokenType,
    gradients: tokenGradients,
    elevation: ambientElevation,
    statusColors,
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
