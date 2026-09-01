import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';

/**
 * Heart toggle backed by FavoritesContext, so every instance for the same
 * listing renders identical state.
 *
 * variant "overlay" floats on top of a listing image, "plain" sits in a header.
 */
export default function FavoriteButton({
  listingId,
  variant = 'overlay',
  size = 20,
  style,
  onToggled,
}) {
  const { colors, isDarkMode } = useTheme();
  const { isFavorite, isPending, toggleFavorite } = useFavorites();

  const favorited = isFavorite(listingId);
  const pending = isPending(listingId);

  const handlePress = useCallback(
    async (event) => {
      event?.stopPropagation?.();
      if (pending) return;
      const wasFavorite = favorited;
      const result = await toggleFavorite(listingId);
      // Only notify when the server-backed state actually changed.
      if (result !== wasFavorite) {
        onToggled?.(result);
      }
    },
    [favorited, listingId, onToggled, pending, toggleFavorite]
  );

  const overlayBackground = isDarkMode ? 'rgba(9, 9, 11, 0.65)' : 'rgba(255, 255, 255, 0.9)';
  const inactiveColor = variant === 'overlay' ? (isDarkMode ? '#ffffff' : '#1a1c1c') : colors.text;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={pending}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={favorited ? 'Remove from saved listings' : 'Save listing'}
      style={[
        variant === 'overlay' && [styles.overlay, { backgroundColor: overlayBackground }],
        pending && styles.pending,
        style,
      ]}
    >
      <Ionicons
        name={favorited ? 'heart' : 'heart-outline'}
        size={size}
        color={favorited ? '#ef4444' : inactiveColor}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pending: {
    opacity: 0.6,
  },
});
