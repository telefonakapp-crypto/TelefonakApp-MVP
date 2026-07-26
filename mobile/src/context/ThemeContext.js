import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const lightColors = {
  // Background colors
  background: '#f2f4f7',
  surface: '#ffffff',
  card: '#ffffff',
  
  // Text colors
  text: '#09090b',
  textSecondary: '#71717a',
  textMuted: '#a1a1aa',
  
  // Border colors
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  // Primary colors
  primary: '#667eea',
  primaryDark: '#5568d3',
  
  // Accent colors
  accent: '#667eea',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  
  // Special backgrounds
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: '#000000',
  
  // Input backgrounds
  inputBackground: '#f8fafc',
  inputBorder: '#e2e8f0',
};

const darkColors = {
  // Background colors
  background: '#09090b',
  surface: '#18181b',
  card: '#27272a',
  
  // Text colors
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  
  // Border colors
  border: '#3f3f46',
  borderLight: '#27272a',
  
  // Primary colors
  primary: '#818cf8',
  primaryDark: '#667eea',
  
  // Accent colors
  accent: '#818cf8',
  error: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
  
  // Special backgrounds
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: '#000000',
  
  // Input backgrounds
  inputBackground: '#27272a',
  inputBorder: '#3f3f46',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load theme preference from AsyncStorage
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          // Default to light mode
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
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

