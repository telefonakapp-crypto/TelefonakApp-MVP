// RTL-aware style utilities
// Helper functions to create direction-aware styles

/**
 * Creates a flexDirection style based on RTL
 * @param {boolean} isRTL - Whether the layout should be RTL
 * @param {string} defaultDirection - Default direction ('row' or 'column')
 * @returns {object} Style object with flexDirection
 */
export const getFlexDirection = (isRTL, defaultDirection = 'row') => {
  if (defaultDirection === 'row') {
    return { flexDirection: isRTL ? 'row-reverse' : 'row' };
  }
  return { flexDirection: defaultDirection };
};

/**
 * Creates text alignment style based on RTL
 * @param {boolean} isRTL - Whether the layout should be RTL
 * @param {string} defaultAlign - Default alignment ('left', 'right', 'center', 'auto')
 * @returns {object} Style object with textAlign
 */
export const getTextAlign = (isRTL, defaultAlign = 'left') => {
  if (defaultAlign === 'auto') {
    return { textAlign: isRTL ? 'right' : 'left' };
  }
  if (defaultAlign === 'left') {
    return { textAlign: isRTL ? 'right' : 'left' };
  }
  if (defaultAlign === 'right') {
    return { textAlign: isRTL ? 'left' : 'right' };
  }
  return { textAlign: defaultAlign };
};

/**
 * Creates padding style with RTL-aware left/right
 * @param {boolean} isRTL - Whether the layout should be RTL
 * @param {number|object} padding - Padding value or object with left/right
 * @returns {object} Style object with padding
 */
export const getPadding = (isRTL, padding) => {
  if (typeof padding === 'number') {
    return { padding };
  }
  if (typeof padding === 'object' && padding.left !== undefined) {
    return {
      paddingLeft: isRTL ? padding.right : padding.left,
      paddingRight: isRTL ? padding.left : padding.right,
      ...(padding.top !== undefined && { paddingTop: padding.top }),
      ...(padding.bottom !== undefined && { paddingBottom: padding.bottom }),
    };
  }
  return {};
};

/**
 * Creates margin style with RTL-aware left/right
 * @param {boolean} isRTL - Whether the layout should be RTL
 * @param {number|object} margin - Margin value or object with left/right
 * @returns {object} Style object with margin
 */
export const getMargin = (isRTL, margin) => {
  if (typeof margin === 'number') {
    return { margin };
  }
  if (typeof margin === 'object' && margin.left !== undefined) {
    return {
      marginLeft: isRTL ? margin.right : margin.left,
      marginRight: isRTL ? margin.left : margin.right,
      ...(margin.top !== undefined && { marginTop: margin.top }),
      ...(margin.bottom !== undefined && { marginBottom: margin.bottom }),
    };
  }
  return {};
};

