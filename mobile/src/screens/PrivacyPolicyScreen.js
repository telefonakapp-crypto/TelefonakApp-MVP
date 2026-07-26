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

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('privacyPolicy.privacyPolicy')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.lastUpdated')}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.introduction')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.introductionText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.informationWeCollect')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.informationWeCollectText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.personalInformation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.profileInformation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.listingInformation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.communicationData')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.howWeUseYourInformation')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.howWeUseYourInformationText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.provideServices')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.processListings')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.sendNotifications')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.respondInquiries')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.detectFraud')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.informationSharing')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.informationSharingText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.shareWithUsers')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.shareWithServiceProviders')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.shareWhenRequiredByLaw')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.dataSecurity')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.dataSecurityText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.yourRights')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.yourRightsText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.accessInformation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.updateInformation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.deleteAccount')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('privacyPolicy.optOutCommunications')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('privacyPolicy.contactUs')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('privacyPolicy.contactUsText')}
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
  lastUpdated: {
    fontSize: 12,
    marginBottom: 24,
    fontStyle: 'italic',
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

