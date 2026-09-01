/**
 * Telefonak design tokens — Clinical Sanctuary philosophy
 * extended for marketplace (designs/DESIGN_SYSTEM.md).
 * Brand primary: #1976D2
 */
export const fonts = {
  display: 'Manrope_700Bold',
  headline: 'Manrope_600SemiBold',
  headlineRegular: 'Manrope_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  label: 'Inter_500Medium',
  labelBold: 'Inter_600SemiBold',
};

/** Soft-touch radius — xl = 0.75rem */
export const radii = {
  sm: 8,
  md: 10,
  xl: 12,
  '2xl': 16,
  full: 9999,
};

/**
 * Spacing scale (dp). Prefer these over magic numbers.
 * Major sections should use space[20] (80) between blocks when redesigning screens.
 */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  8: 48,
  10: 64,
  20: 80,
};

/** Type scale — pair with fonts.* */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  headline: { fontFamily: fonts.headline, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fonts.headline, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.label, fontSize: 14, lineHeight: 18 },
  labelSm: { fontFamily: fonts.label, fontSize: 12, lineHeight: 16 },
};

export const brand = {
  primary: '#1976D2',
  primaryPressed: '#1565C0',
  primaryDeep: '#1976D2',
  primaryContainer: '#1976D2',
  onPrimary: '#ffffff',
  onSurface: '#1a1c1c',
  secondary: '#526069',
  surface: '#f9f9f9',
  surfaceLow: '#f3f3f3',
  surfaceContainer: '#eeeeee',
  surfaceLowest: '#ffffff',
  success: '#266931',
  successSoft: '#abf4ac',
  error: '#ef4444',
  warning: '#f59e0b',
  outlineVariant: '#c1c6d4',
  ghostBorder: 'rgba(193, 198, 212, 0.2)',
  ambientShadow: 'rgba(26, 28, 28, 0.04)',
  focusAura: 'rgba(25, 118, 210, 0.1)',
};

/** App CTAs use brand primary. Splash uses the Guardian Blue vertical gradient. */
export const gradients = {
  primary: [brand.primary, brand.primary],
  splash: ['#0D47A1', '#1976D2'],
};

/** Ambient elevation — soft lift, not hard drop-shadow */
export const ambientElevation = {
  shadowColor: brand.ambientShadow,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 1,
  shadowRadius: 32,
  elevation: 4,
};

export const statusColors = {
  pending: '#ca8a04',
  approved: '#266931',
  declined: '#ef4444',
  sold: '#526069',
  resubmitted: '#1976D2',
  updated: '#4338ca',
  deleted: '#7a848c',
  hidden: '#7c3aed',
};
