import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

export default function UserGuideScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('userGuide.userGuide')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.gettingStarted')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.gettingStartedText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.creatingListing')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.creatingListingText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.tapPlusButton')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.selectBrandModel')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.chooseDetails')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.addPhotos')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.enterPriceDescription')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.submitListing')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.browsingListings')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.browsingListingsText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.brand')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.storageCapacity')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.conditionFilter')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.priceRange')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.managingListings')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.managingListingsText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.viewDetails')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.editPending')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.markSold')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.deleteListing')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.notificationsSection')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.notificationsText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.listingApproved')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('userGuide.listingDeclined')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('userGuide.needMoreHelp')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('userGuide.needMoreHelpText')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
});

