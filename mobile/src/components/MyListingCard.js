import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { resolveMediaUrl } from '../utils/api';
import { fonts, radii, space } from '../utils/designTokens';
import { getListingDisplayName } from '../utils/listingDisplayName';
import { Button, Card, Chip, StatusBadge } from './ui';

/**
 * Compact My Listings card — image + copy on one row, status beside views,
 * optional review note, then a wide Edit action and overflow button.
 */
export function MyListingCard({
  listing,
  isHistory = false,
  isDeleted = false,
  showEdit = false,
  showUpdate = false,
  showOverflow = false,
  showListAgain = false,
  statusLabel,
  saleTypeLabel,
  declineReason,
  reviewMessage,
  reviewFeedbackTitle,
  editLabel,
  moreLabel,
  listAgainLabel,
  onPress,
  onEdit,
  onOpenMenu,
  onListAgain,
}) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const title = getListingDisplayName(listing.brand_name, listing.model_name);
  const views =
    listing.views !== undefined && listing.views !== null ? listing.views : null;
  const showViews = views !== null;

  const imageMargin = {
    marginRight: isRTL ? 0 : space[3],
    marginLeft: isRTL ? space[3] : 0,
  };

  return (
    <Card
      style={[
        styles.card,
        isHistory && styles.historyCard,
        isDeleted && styles.deletedCard,
      ]}
      elevated
      padded={false}
    >
      <View style={styles.pad}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <View style={[styles.topRow, getFlexDirection(isRTL, 'row')]}>
            {listing.thumbnail_image ? (
              <Image
                source={{ uri: resolveMediaUrl(listing.thumbnail_image) }}
                style={[
                  styles.thumbnail,
                  isHistory && styles.historyThumb,
                  imageMargin,
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.thumbnailPlaceholder,
                  { backgroundColor: colors.surfaceContainerLow },
                  isHistory && styles.historyThumb,
                  imageMargin,
                ]}
              >
                <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              </View>
            )}

            <View style={styles.copy}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text },
                  isHistory && styles.historyText,
                  getTextAlign(isRTL, 'auto'),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>

              <Text
                style={[
                  styles.price,
                  { color: colors.primary },
                  isHistory && styles.historyText,
                  getTextAlign(isRTL, 'auto'),
                ]}
                numberOfLines={1}
              >
                {listing.price} JOD
              </Text>

              <View style={[styles.statusRow, getFlexDirection(isRTL, 'row')]}>
                <StatusBadge
                  status={listing.status}
                  label={statusLabel}
                  style={styles.statusBadge}
                  textStyle={styles.statusText}
                />
                {saleTypeLabel ? (
                  <Chip
                    label={saleTypeLabel}
                    style={styles.bidChip}
                    textStyle={styles.bidChipText}
                  />
                ) : null}
                {showViews ? (
                  <View style={[styles.views, getFlexDirection(isRTL, 'row')]}>
                    <Ionicons
                      name="eye-outline"
                      size={15}
                      color={colors.textMuted}
                    />
                    <Text style={[styles.viewsText, { color: colors.textMuted }]}>
                      {views}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {reviewMessage ? (
          <View
            style={[
              styles.reviewNote,
              { backgroundColor: colors.surfaceContainerLow },
              getFlexDirection(isRTL, 'row'),
            ]}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.reviewNoteText,
                { color: colors.textSecondary },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {reviewMessage}
            </Text>
          </View>
        ) : null}

        {showUpdate && declineReason ? (
          <View
            style={[
              styles.feedbackCard,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            {reviewFeedbackTitle ? (
              <Text style={[styles.feedbackTitle, { color: colors.text }]}>
                {reviewFeedbackTitle}
              </Text>
            ) : null}
            <Text
              style={[
                styles.feedbackBody,
                { color: colors.textSecondary },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {declineReason}
            </Text>
          </View>
        ) : null}

        {showListAgain || (!isHistory && (showEdit || showUpdate || showOverflow)) ? (
          <View style={[styles.actions, getFlexDirection(isRTL, 'row')]}>
            {showListAgain ? (
              <Button
                label={listAgainLabel}
                onPress={onListAgain}
                style={styles.editButton}
                textStyle={styles.editButtonText}
                fullWidth={false}
              />
            ) : showEdit || showUpdate ? (
              <Button
                label={editLabel}
                onPress={onEdit}
                style={styles.editButton}
                textStyle={styles.editButtonText}
                fullWidth={false}
              />
            ) : (
              <View style={styles.editButton} />
            )}

            {!isHistory && showOverflow ? (
              <TouchableOpacity
                style={[
                  styles.moreButton,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
                onPress={onOpenMenu}
                accessibilityRole="button"
                accessibilityLabel={moreLabel}
                hitSlop={8}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const THUMB = 80;
const ACTION = 44;

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  historyCard: {
    opacity: 0.78,
  },
  deletedCard: {
    opacity: 0.62,
  },
  pad: {
    padding: space[4],
    gap: 10,
  },
  topRow: {
    alignItems: 'stretch',
  },
  thumbnail: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.md,
  },
  thumbnailPlaceholder: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyThumb: {
    opacity: 0.5,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.headline,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  price: {
    fontFamily: fonts.headline,
    fontSize: 16,
    lineHeight: 20,
  },
  historyText: {
    opacity: 0.75,
  },
  statusRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  bidChip: {
    alignSelf: 'center',
    minHeight: 24,
    paddingVertical: 4,
    paddingHorizontal: space[3],
  },
  bidChipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  views: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  viewsText: {
    fontFamily: fonts.label,
    fontSize: 13,
  },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: space[3],
    borderRadius: radii.md,
  },
  reviewNoteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackCard: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: space[3],
    borderRadius: radii.md,
  },
  feedbackTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  feedbackBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    alignItems: 'center',
    gap: space[2],
  },
  editButton: {
    flex: 1,
    minWidth: 0,
    height: ACTION,
    minHeight: ACTION,
    paddingVertical: 0,
    paddingHorizontal: space[4],
    borderRadius: radii.xl,
  },
  editButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 16,
  },
  moreButton: {
    width: ACTION,
    height: ACTION,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
