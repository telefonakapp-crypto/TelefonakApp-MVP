import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../../utils/rtlStyles';
import NavBadge from '../../components/NavBadge';
import BottomNavBackground from '../../components/BottomNavBackground';
import SellPhoneButton from '../../components/SellPhoneButton';

export default function HomeBottomNav({ unreadOffersCount, onSell }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [sellButtonCenterX, setSellButtonCenterX] = useState(null);
  const [bottomNavWidth, setBottomNavWidth] = useState(0);

  return (
    <View
      style={[
        styles.bottomNav,
        { backgroundColor: 'transparent' },
        getFlexDirection(isRTL, 'row'),
      ]}
      onLayout={({ nativeEvent }) => {
        const { width } = nativeEvent.layout;
        setBottomNavWidth((currentWidth) =>
          currentWidth === width ? currentWidth : width
        );
      }}
    >
      <BottomNavBackground color={colors.surface} />
      <TouchableOpacity style={styles.navItem}>
        <Ionicons name="home" size={24} color={colors.primary} />
        <Text style={[styles.navLabel, styles.navLabelActive, { color: colors.primary }, getTextAlign(isRTL, 'auto')]}>{t('home.home')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate('MyListings')}
      >
        <Ionicons name="list-outline" size={24} color={colors.textSecondary} />
        <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('home.myListings')}</Text>
      </TouchableOpacity>
      <View
        style={[
          styles.addButtonContainer,
          {
            transform: [
              {
                translateX:
                  bottomNavWidth && sellButtonCenterX != null
                    ? bottomNavWidth / 2 - sellButtonCenterX
                    : 0,
              },
            ],
          },
        ]}
        onLayout={({ nativeEvent }) => {
          const { x, width } = nativeEvent.layout;
          const nextCenter = x + width / 2;
          setSellButtonCenterX((currentCenter) =>
            currentCenter === nextCenter ? currentCenter : nextCenter
          );
        }}
      >
        <View style={styles.sellPhoneButtonLift}>
          <SellPhoneButton
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={onSell}
            accessibilityLabel={t('home.sellPhone')}
          />
        </View>
        <Text style={[styles.navLabel, { color: colors.textSecondary }]}>
          {t('home.sellPhone')}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate('Offers')}
        accessibilityRole="button"
        accessibilityLabel={t('home.offersNav') || t('offers.offersTab') || 'Offers'}
      >
        <View style={styles.navIconContainer}>
          <Ionicons name="pricetag-outline" size={24} color={colors.textSecondary} />
          <NavBadge
            count={unreadOffersCount}
            color={colors.error}
            style={styles.navOffersBadge}
          />
        </View>
        <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('home.offersNav') || t('offers.offersTab') || 'Offers'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate('SavedListings')}
      >
        <Ionicons name="heart-outline" size={24} color={colors.textSecondary} />
        <Text style={[styles.navLabel, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
          {t('home.savedNav') || t('profile.savedListings') || 'Saved'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    borderTopWidth: 0,
    padding: 16,
    paddingBottom: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  navItem: {
    alignItems: 'center',
    zIndex: 2,
  },
  navIconContainer: {
    position: 'relative',
  },
  navOffersBadge: {
    top: -4,
    right: -10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navLabel: {
    fontSize: 10, // text-[10px]
    fontWeight: '500',
    color: '#71717a', // text-muted-foreground
    marginTop: 4, // gap-1 equivalent
  },
  addButtonContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -28, // Raise the entire container up
    zIndex: 2,
  },
  sellPhoneButtonLift: {
    marginTop: -16,
    marginBottom: 16,
  },
  addButton: {
    width: 56, // w-14
    height: 56, // h-14
    borderRadius: 28, // rounded-full
    backgroundColor: '#1976D2', // bg-secondary (using primary)
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabelActive: {
    color: '#1976D2', // text-primary
  },
});
