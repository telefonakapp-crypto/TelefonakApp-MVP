import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { resolveMediaUrl } from '../../utils/api';
import { getListingDisplayName } from '../../utils/listingDisplayName';
import { localizeConditionName } from '../../utils/listingCondition';
import { showToast } from '../../utils/toast';
import { fonts, radii } from '../../utils/designTokens';
import FavoriteButton from '../../components/FavoriteButton';

export default function HomeListingCard({ listing, isOwn, onPress }) {
  const { colors, isDarkMode } = useTheme();
  const { isRTL, t } = useLanguage();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View
        style={[
          styles.cardImageContainer,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        {listing.thumbnail_image ? (
          <Image
            source={{ uri: resolveMediaUrl(listing.thumbnail_image) }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.surfaceContainerLow }]} />
        )}
        {!isOwn ? (
          <FavoriteButton
            listingId={listing.id}
            size={18}
            onToggled={(isNowFavorite) => {
              showToast(
                isNowFavorite
                  ? t('savedListings.savedToast') || 'Saved to your list'
                  : t('savedListings.removedToast') || 'Removed from saved'
              );
            }}
            style={{
              left: isRTL ? 'auto' : 8,
              right: isRTL ? 8 : 'auto',
            }}
          />
        ) : null}
        <View
          style={[
            styles.conditionBadge,
            {
              backgroundColor: isDarkMode
                ? 'rgba(30, 33, 33, 0.92)'
                : 'rgba(255, 255, 255, 0.92)',
              left: isRTL ? 8 : 'auto',
              right: isRTL ? 'auto' : 8,
            },
          ]}
        >
          <Text
            style={[styles.conditionText, { color: colors.text }]}
            numberOfLines={1}
          >
            {localizeConditionName(listing.condition_name, t)}
          </Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {getListingDisplayName(listing.brand_name, listing.model_name)}
        </Text>
        <Text style={[styles.cardPrice, { color: colors.primary }]}>{listing.price} JOD</Text>
        {(listing.capacity_gb || listing.color_name) ? (
          <Text
            style={[styles.cardMeta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {[
              listing.capacity_gb ? `${listing.capacity_gb} GB` : null,
              listing.color_name || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : (
          <View style={styles.cardMetaSpacer} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 2,
  },
  cardImageContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    maxWidth: '78%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  conditionText: {
    fontFamily: fonts.labelBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    minHeight: 36,
    fontFamily: fonts.headline,
    fontSize: 14,
    lineHeight: 18,
    color: '#1a1c1c',
  },
  cardPrice: {
    color: '#1976D2', // text-primary
    fontFamily: fonts.display,
    marginTop: 4,
    fontSize: 17,
    lineHeight: 22,
  },
  cardMeta: {
    minHeight: 16,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  cardMetaSpacer: {
    minHeight: 19,
  },
});
