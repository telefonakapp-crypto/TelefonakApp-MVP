import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../utils/translations';
import {
  LANGUAGE_STORAGE_KEY,
  isSupportedLanguage,
  languageToIsRTL,
  detectPreferredAppLanguage,
} from '../utils/layoutDirection';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en'); // 'en' or 'ar'
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        // Native LTR lock runs in App.js bootstrap before navigation mounts.
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (!cancelled) {
          if (isSupportedLanguage(savedLanguage)) {
            setLanguage(savedLanguage);
          } else {
            setLanguage(detectPreferredAppLanguage());
          }
        }
      } catch (error) {
        console.error('Error loading language:', error);
        if (!cancelled) setLanguage('en');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeLanguage = useCallback(async (newLanguage) => {
    if (!isSupportedLanguage(newLanguage)) {
      console.error('Invalid language:', newLanguage);
      return;
    }

    // Sole source of truth: persist language. Layout is derived from this.
    setLanguage(newLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  }, []);

  // Helper function to get content in current language, with fallback
  const getText = (textEn, textAr) => {
    if (language === 'ar') {
      return textAr || textEn || '';
    }
    return textEn || textAr || '';
  };

  // Translation function - gets translation by key path (e.g., 'auth.welcomeBack')
  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let value = translations[language];

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return keyPath;
          }
        }
        break;
      }
    }

    return typeof value === 'string' ? value : keyPath;
  };

  const isArabic = (text) => {
    if (!text) return false;
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
  };

  const value = {
    language,
    changeLanguage,
    // Derived only from appLanguage — never from I18nManager.isRTL
    isRTL: languageToIsRTL(language),
    isLoading,
    getText,
    t,
    isArabic,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
