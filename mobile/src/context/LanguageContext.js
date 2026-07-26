import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { translations } from '../utils/translations';

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
    // Load language preference from AsyncStorage
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('appLanguage');
        if (savedLanguage !== null && (savedLanguage === 'en' || savedLanguage === 'ar')) {
          setLanguage(savedLanguage);
          // Set RTL for Arabic
          if (savedLanguage === 'ar' && !I18nManager.isRTL) {
            I18nManager.forceRTL(true);
            I18nManager.allowRTL(true);
          } else if (savedLanguage === 'en' && I18nManager.isRTL) {
            I18nManager.forceRTL(false);
            I18nManager.allowRTL(false);
          }
        } else {
          // Default to English
          setLanguage('en');
        }
      } catch (error) {
        console.error('Error loading language:', error);
        setLanguage('en');
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const changeLanguage = async (newLanguage) => {
    if (newLanguage !== 'en' && newLanguage !== 'ar') {
      console.error('Invalid language:', newLanguage);
      return;
    }

    setLanguage(newLanguage);
    
    // Set RTL for Arabic
    if (newLanguage === 'ar' && !I18nManager.isRTL) {
      I18nManager.forceRTL(true);
      I18nManager.allowRTL(true);
    } else if (newLanguage === 'en' && I18nManager.isRTL) {
      I18nManager.forceRTL(false);
      I18nManager.allowRTL(false);
    }

    try {
      await AsyncStorage.setItem('appLanguage', newLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  // Helper function to get content in current language, with fallback
  const getText = (textEn, textAr) => {
    if (language === 'ar') {
      return textAr || textEn || ''; // Fallback to English if Arabic not available
    }
    return textEn || textAr || ''; // Fallback to Arabic if English not available
  };

  // Translation function - gets translation by key path (e.g., 'auth.welcomeBack')
  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let value = translations[language];
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        // Fallback to English if translation not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return keyPath; // Return key path if translation not found
          }
        }
        break;
      }
    }
    
    return typeof value === 'string' ? value : keyPath;
  };

  // Helper to detect if text is Arabic
  const isArabic = (text) => {
    if (!text) return false;
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
  };

  const value = {
    language,
    changeLanguage,
    isRTL: language === 'ar',
    isLoading,
    getText,
    t, // Translation function
    isArabic,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

