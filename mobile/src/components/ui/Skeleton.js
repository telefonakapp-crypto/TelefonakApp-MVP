import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { radii, space } from '../../utils/designTokens';

const sharedOpacity = new Animated.Value(0.45);
let sharedLoop = null;
let pulseConsumers = 0;
let reduceMotionEnabled = false;

function startSharedPulse() {
  if (sharedLoop || reduceMotionEnabled || pulseConsumers === 0) return;
  sharedLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(sharedOpacity, {
        toValue: 0.45,
        duration: 700,
        useNativeDriver: true,
      }),
    ])
  );
  sharedLoop.start();
}

function stopSharedPulse() {
  sharedLoop?.stop();
  sharedLoop = null;
}

AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  reduceMotionEnabled = enabled;
  if (enabled) {
    stopSharedPulse();
    sharedOpacity.setValue(0.65);
  } else {
    sharedOpacity.setValue(0.45);
    startSharedPulse();
  }
});

AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reduceMotionEnabled = enabled;
  if (enabled) {
    stopSharedPulse();
    sharedOpacity.setValue(0.65);
  } else {
    sharedOpacity.setValue(0.45);
    startSharedPulse();
  }
});

/**
 * Soft pulse loading placeholder.
 */
export function Skeleton({ width = '100%', height = 16, radius = radii.xl, style }) {
  const { colors } = useTheme();

  useEffect(() => {
    pulseConsumers += 1;
    startSharedPulse();
    return () => {
      pulseConsumers = Math.max(0, pulseConsumers - 1);
      if (pulseConsumers === 0) stopSharedPulse();
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceContainer,
          opacity: sharedOpacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonGroup({ lines = 3, style }) {
  return (
    <View style={[styles.group, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={14}
          style={styles.line}
        />
      ))}
    </View>
  );
}

export function MarketplaceCardSkeleton({ imageHeight = 168, style }) {
  return (
    <View style={[styles.marketplaceCard, style]}>
      <Skeleton height={imageHeight} radius={radii['2xl']} />
      <Skeleton width="82%" height={16} style={styles.marketplaceTitle} />
      <Skeleton width="54%" height={20} />
      <Skeleton width="68%" height={12} style={styles.marketplaceMeta} />
    </View>
  );
}

export function HorizontalCardSkeleton({ action = false, style }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <View style={[styles.horizontalCard, { backgroundColor: colors.card }, style]}>
      <View style={[styles.horizontalMain, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Skeleton width={96} height={96} radius={radii['2xl']} />
        <View
          style={[
            styles.horizontalInfo,
            {
              marginLeft: isRTL ? 0 : space[3],
              marginRight: isRTL ? space[3] : 0,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <Skeleton width="86%" height={17} />
          <Skeleton width="44%" height={12} style={styles.horizontalGap} />
          <Skeleton width="60%" height={24} style={styles.horizontalSmallGap} />
          <Skeleton width="72%" height={12} style={styles.horizontalSmallGap} />
        </View>
      </View>
      <View style={styles.horizontalMeta}>
        <Skeleton width={82} height={25} radius={radii.full} />
        <Skeleton width={84} height={12} />
      </View>
      {action ? <Skeleton height={46} style={styles.horizontalAction} /> : null}
    </View>
  );
}

export function DetailScreenSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton height={320} radius={0} />
      <View style={styles.detailBody}>
        <Skeleton width="45%" height={32} />
        <Skeleton width="78%" height={22} style={styles.detailGap} />
        <Skeleton width={90} height={27} radius={radii.full} style={styles.detailGap} />
        <View style={styles.detailGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} width="48%" height={78} radius={radii['2xl']} />
          ))}
        </View>
        <Skeleton height={132} radius={radii['2xl']} style={styles.detailSection} />
        <Skeleton height={150} radius={radii['2xl']} style={styles.detailSection} />
      </View>
    </View>
  );
}

export function FormScreenSkeleton() {
  return (
    <View style={styles.form}>
      <Skeleton width="70%" height={30} />
      <Skeleton width="92%" height={15} style={styles.formSubtitle} />
      <Skeleton height={6} radius={radii.full} style={styles.formProgress} />
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.formField}>
          <Skeleton width="34%" height={13} />
          <Skeleton height={56} radius={radii.xl} style={styles.formControl} />
        </View>
      ))}
    </View>
  );
}

export function ProfileScreenSkeleton() {
  return (
    <View style={styles.profile}>
      <Skeleton width={96} height={96} radius={radii.full} />
      <Skeleton width="48%" height={22} style={styles.profileName} />
      <Skeleton width="32%" height={14} style={styles.profilePhone} />
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={styles.profileGroup}>
          <Skeleton width="28%" height={12} />
          <Skeleton height={118} radius={radii['2xl']} style={styles.profileRows} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  group: {
    gap: 10,
  },
  line: {
    marginBottom: 0,
  },
  marketplaceCard: {
    width: '48%',
  },
  marketplaceTitle: {
    marginTop: space[3],
    marginBottom: space[2],
  },
  marketplaceMeta: {
    marginTop: space[2],
  },
  horizontalCard: {
    borderRadius: radii['2xl'] + 4,
    padding: space[4],
  },
  horizontalMain: {
    alignItems: 'flex-start',
  },
  horizontalInfo: {
    flex: 1,
  },
  horizontalGap: {
    marginTop: space[2],
  },
  horizontalSmallGap: {
    marginTop: space[1],
  },
  horizontalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  horizontalAction: {
    marginTop: space[4],
  },
  detail: {
    flex: 1,
  },
  detailBody: {
    padding: space[5],
  },
  detailGap: {
    marginTop: space[2],
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space[3],
    marginTop: space[5],
  },
  detailSection: {
    marginTop: space[5],
  },
  form: {
    paddingHorizontal: space[5],
    paddingTop: space[5],
  },
  formSubtitle: {
    marginTop: space[2],
  },
  formProgress: {
    marginTop: space[5],
    marginBottom: space[5],
  },
  formField: {
    marginBottom: space[4],
  },
  formControl: {
    marginTop: space[2],
  },
  profile: {
    alignItems: 'center',
    paddingHorizontal: space[5],
    paddingTop: space[5],
  },
  profileName: {
    marginTop: space[4],
  },
  profilePhone: {
    marginTop: space[2],
  },
  profileGroup: {
    alignSelf: 'stretch',
    marginTop: space[6],
  },
  profileRows: {
    marginTop: space[2],
  },
});
