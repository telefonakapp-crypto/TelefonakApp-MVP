import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useOffersUnread } from '../context/OffersUnreadContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';
import { fonts, radii, space } from '../utils/designTokens';
import MyOffersScreen from './MyOffersScreen';
import ReceivedOffersScreen from './ReceivedOffersScreen';

export default function OffersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const { unreadOffersCount } = useOffersUnread();

  const requestedSegment = route.params?.initialSegment;
  const [segment, setSegment] = useState(() => {
    if (requestedSegment === 'received' || requestedSegment === 'my') {
      return requestedSegment;
    }
    return unreadOffersCount > 0 ? 'received' : 'my';
  });

  // Deep-link / notification can ask for Received without remounting.
  useEffect(() => {
    if (requestedSegment === 'received' || requestedSegment === 'my') {
      setSegment(requestedSegment);
    }
  }, [requestedSegment]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={[styles.titleRow, getFlexDirection(isRTL, 'row')]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerLeft}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('offers.offersTab') || t('listingDetails.offersLabel') || 'Offers'}
          </Text>
        </View>
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary },
            getTextAlign(isRTL, 'auto'),
            {
              marginLeft: isRTL ? 0 : 40,
              marginRight: isRTL ? 40 : 0,
            },
          ]}
        >
          {t('offers.offersSubtitle')}
        </Text>
        <View
          style={[
            styles.segmentTrack,
            { backgroundColor: colors.surfaceContainerLow },
            getFlexDirection(isRTL, 'row'),
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segment,
              segment === 'my' && { backgroundColor: colors.surface },
              segment === 'my' && styles.segmentActiveShadow,
            ]}
            onPress={() => setSegment('my')}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === 'my' }}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: segment === 'my' ? colors.primary : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {t('offers.myOffers')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              segment === 'received' && { backgroundColor: colors.surface },
              segment === 'received' && styles.segmentActiveShadow,
            ]}
            onPress={() => setSegment('received')}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === 'received' }}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: segment === 'received' ? colors.primary : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {t('offers.receivedOffers')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {segment === 'my' ? (
          <MyOffersScreen embedded />
        ) : (
          <ReceivedOffersScreen embedded />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[4],
  },
  titleRow: {
    alignItems: 'center',
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space[1],
    marginBottom: space[4],
  },
  segmentTrack: {
    borderRadius: radii['2xl'],
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveShadow: {
    shadowColor: 'rgba(26, 28, 28, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentLabel: {
    fontFamily: fonts.labelBold,
    fontSize: 13,
  },
  body: {
    flex: 1,
  },
});
