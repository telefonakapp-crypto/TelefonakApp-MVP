/**
 * Layout direction — single source of truth.
 *
 * Language preference lives in AsyncStorage (`appLanguage`).
 * UI mirroring is driven ONLY by LanguageContext.isRTL (language === 'ar').
 *
 * Native I18nManager RTL must stay OFF. Mixing forceRTL(true) with manual
 * row-reverse helpers causes double-flips and "random" LTR/RTL after restart,
 * because forceRTL only applies after a reload and can disagree with appLanguage.
 */

import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';

export const LANGUAGE_STORAGE_KEY = 'appLanguage';

/** One-shot guard so a failed LTR lock cannot reload forever. */
const LTR_LOCK_RELOAD_KEY = 'layoutDirection.ltrLockReload';

export function isSupportedLanguage(value) {
  return value === 'en' || value === 'ar';
}

export function languageToIsRTL(language) {
  return language === 'ar';
}

/**
 * Map a BCP 47 / Apple / Android locale tag to an app language.
 * Uses the language subtag only — never region/country.
 */
export function languageFromLocaleTag(tag) {
  if (!tag || typeof tag !== 'string') return 'en';
  const primary = tag.trim().replace(/_/g, '-').split('-')[0].toLowerCase();
  return primary === 'ar' ? 'ar' : 'en';
}

function readNativeLocaleTag() {
  try {
    // Lazy require so Node-side unit tests can import the pure mapper.
    // eslint-disable-next-line global-require
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      return settings?.AppleLanguages?.[0] || settings?.AppleLocale || '';
    }
    return NativeModules.I18nManager?.localeIdentifier || '';
  } catch {
    return '';
  }
}

function readIntlLocaleTag() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || '';
  } catch {
    return '';
  }
}

/** Preferred device language → 'ar' | 'en'. English is the fallback. */
export function detectPreferredAppLanguage() {
  return languageFromLocaleTag(readNativeLocaleTag() || readIntlLocaleTag());
}

/**
 * Lock native layout to LTR so manual RTL helpers are the only controller.
 * If the native flag is still RTL (from a previous forceRTL), apply LTR and
 * reload once so the process picks it up.
 *
 * @returns {Promise<{ reloaded: boolean }>}
 */
export async function ensureNativeLayoutIsLTR() {
  I18nManager.allowRTL(false);

  if (!I18nManager.isRTL) {
    await AsyncStorage.removeItem(LTR_LOCK_RELOAD_KEY);
    return { reloaded: false };
  }

  I18nManager.forceRTL(false);

  const alreadyReloaded = await AsyncStorage.getItem(LTR_LOCK_RELOAD_KEY);
  if (alreadyReloaded === '1') {
    return { reloaded: false };
  }

  await AsyncStorage.setItem(LTR_LOCK_RELOAD_KEY, '1');
  await reloadAppAsync();
  return { reloaded: true };
}
