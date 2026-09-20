/**
 * Appearance preference — stored in AsyncStorage `themeMode`.
 * Existing values `light` and `dark` stay compatible. `system` is new.
 */

export const THEME_STORAGE_KEY = 'themeMode';

export const THEME_MODES = ['light', 'dark', 'system'];

/** Used when storage is missing or invalid. Explicit light/dark are never rewritten. */
export const DEFAULT_THEME_MODE = 'system';

export function isThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Missing/invalid storage → system. Stored light/dark/system unchanged. */
export function normalizeThemeMode(stored) {
  return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
}

/**
 * Effective dark flag for existing `isDarkMode` / `colors` consumers.
 * `systemColorScheme` is `'light' | 'dark' | null | undefined`.
 */
export function resolveIsDarkMode(themeMode, systemColorScheme) {
  const mode = normalizeThemeMode(themeMode);
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemColorScheme === 'dark';
}

/** Branded auth/onboarding keep a fixed status bar; themed screens follow effective theme. */
const BRANDED_BAR_STYLE = {
  AuthChoice: 'light-content',
  Login: 'light-content',
  SignUpPhone: 'light-content',
  Register: 'light-content',
  Onboarding: 'dark-content',
  OTP: 'dark-content',
  Maintenance: 'dark-content',
};

export function statusBarStyleForRoute(routeName, isDarkMode) {
  if (routeName && BRANDED_BAR_STYLE[routeName]) {
    return BRANDED_BAR_STYLE[routeName];
  }
  return isDarkMode ? 'light-content' : 'dark-content';
}
