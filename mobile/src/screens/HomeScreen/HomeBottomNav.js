import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../../utils/rtlStyles';
import NavBadge from '../../components/NavBadge';
import BottomNavBackground from '../../components/BottomNavBackground';
import SellPhoneButton from '../../components/SellPhoneButton';

function HomeHouseIcon({ color }) {
  return (
    <View style={styles.homeHouse}>
      <View style={[styles.homeHouseRoof, { borderBottomColor: color }]} />
      <View style={styles.homeHouseBody}>
        <View style={[styles.homeHouseLintel, { backgroundColor: color }]} />
        <View style={styles.homeHouseBottom}>
          <View style={[styles.homeHouseWall, styles.homeHouseWallLeft, { backgroundColor: color }]} />
          <View style={styles.homeHouseDoor} />
          <View style={[styles.homeHouseWall, styles.homeHouseWallRight, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

export default function HomeBottomNav({ unreadOffersCount, onSell }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const activeRouteName = useNavigationState(
    (state) => state?.routes?.[state.index]?.name
  );
  const isHomeActive = activeRouteName === 'Home';
  const inactiveColor = colors.textSecondary;
  const homeIconColor = isHomeActive ? colors.primary : inactiveColor;
  const homeLabelColor = isHomeActive ? colors.primary : inactiveColor;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          getFlexDirection(isRTL, 'row'),
        ]}
      >
        <BottomNavBackground
          color={colors.surface}
          style={styles.barFill}
        />

        <TouchableOpacity style={styles.navSlot}>
          <View
            style={[
              styles.navItemInner,
              isHomeActive && [
                styles.homeActivePill,
                { backgroundColor: colors.focusAura },
              ],
            ]}
          >
            <View style={styles.iconSlot}>
              <HomeHouseIcon color={homeIconColor} />
            </View>
            <Text
              style={[
                styles.navLabel,
                isHomeActive && styles.navLabelActive,
                { color: homeLabelColor },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.home')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navSlot}
          onPress={() => navigation.navigate('MyListings')}
        >
          <View style={styles.navItemInner}>
            <View style={styles.iconSlot}>
              <Feather name="grid" size={22} color={inactiveColor} />
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: inactiveColor },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.listingsNav') || t('home.myListings')}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.navSlot, styles.sellSlot]}>
          <View style={styles.navItemInner}>
            <View style={styles.iconSlot}>
              <View style={styles.sellButtonAnchor}>
                <SellPhoneButton
                  style={[
                    styles.addButton,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surface,
                    },
                  ]}
                  onPress={onSell}
                  accessibilityLabel={t('home.sellPhone')}
                />
              </View>
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: inactiveColor },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.sellPhone')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.navSlot}
          onPress={() => navigation.navigate('Offers')}
          accessibilityRole="button"
          accessibilityLabel={t('home.offersNav') || t('offers.offersTab') || 'Offers'}
        >
          <View style={styles.navItemInner}>
            <View style={styles.iconSlot}>
              <View style={styles.navIconContainer}>
                <Ionicons name="pricetag-outline" size={22} color={inactiveColor} />
                <NavBadge
                  count={unreadOffersCount}
                  color={colors.error}
                  style={styles.navOffersBadge}
                />
              </View>
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: inactiveColor },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.offersNav') || t('offers.offersTab') || 'Offers'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navSlot}
          onPress={() => navigation.navigate('SavedListings')}
        >
          <View style={styles.navItemInner}>
            <View style={styles.iconSlot}>
              <Ionicons name="heart-outline" size={22} color={inactiveColor} />
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: inactiveColor },
                getTextAlign(isRTL, 'auto'),
              ]}
            >
              {t('home.savedNav') || t('profile.savedListings') || 'Saved'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 22,
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 4,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  barFill: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  navSlot: {
    flex: 1,
    alignItems: 'center',
    zIndex: 2,
  },
  sellSlot: {
    zIndex: 4,
  },
  navItemInner: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 0,
    borderRadius: 18,
    minWidth: 56,
  },
  homeActivePill: {
    paddingHorizontal: 14,
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeHouse: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeHouseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  homeHouseBody: {
    width: 17,
    marginTop: -1,
  },
  homeHouseLintel: {
    height: 5,
  },
  homeHouseBottom: {
    flexDirection: 'row',
    height: 8,
  },
  homeHouseWall: {
    width: 6,
    height: 8,
  },
  homeHouseWallLeft: {
    borderBottomLeftRadius: 1.5,
  },
  homeHouseWallRight: {
    borderBottomRightRadius: 1.5,
  },
  homeHouseDoor: {
    width: 5,
    height: 8,
  },
  navOffersBadge: {
    top: -4,
    right: -10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },
  navLabelActive: {
    fontWeight: '600',
  },
  sellButtonAnchor: {
    position: 'absolute',
    bottom: 0,
    width: 52,
    left: -14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
