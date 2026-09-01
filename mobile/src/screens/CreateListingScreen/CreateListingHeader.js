import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection } from '../../utils/rtlStyles';
import { fonts, space } from '../../utils/designTokens';
import { Skeleton } from '../../components/ui';

export default function CreateListingHeader({
  step,
  totalSteps,
  onBack,
  loading = false,
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        {loading ? (
          <Skeleton width={96} height={14} />
        ) : (
          <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>
            {(t('createListing.stepOf') || 'Step {current} of {total}')
              .replace('{current}', String(step))
              .replace('{total}', String(totalSteps))}
          </Text>
        )}
        <View style={styles.headerBtn} />
      </View>

      {loading ? null : (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${(step / totalSteps) * 100}%`,
              },
            ]}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMeta: { fontFamily: fonts.label, fontSize: 13 },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(193, 198, 212, 0.25)',
    marginHorizontal: space[4],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2 },
});
