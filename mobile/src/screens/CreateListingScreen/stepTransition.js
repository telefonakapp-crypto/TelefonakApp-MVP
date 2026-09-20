/**
 * Create Listing in-wizard step slide.
 * Direction matches App.js stack cards: LTR from the right, RTL inverted.
 */

/** Same spring as @react-navigation/stack horizontal iOS interpolator. */
export const STEP_TRANSITION_SPRING = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 10,
  restSpeedThreshold: 10,
  useNativeDriver: true,
};

/**
 * Incoming step start X.
 * LTR forward = from right (+width); RTL forward = from left (-width).
 */
export function stepEnterTranslateX(goingForward, isRTL, width) {
  const w = Number(width) || 0;
  const direction = goingForward ? 1 : -1;
  const rtlFlip = isRTL ? -1 : 1;
  return direction * rtlFlip * w;
}
