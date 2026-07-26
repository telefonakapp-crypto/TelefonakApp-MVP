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

export default function TermsOfUseScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('profile.termsOfUse')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.lastUpdated')}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.acceptanceOfTerms')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.acceptanceOfTermsText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.useLicense')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.useLicenseText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.modifyMaterials')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.useMaterialsCommercial')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.reverseEngineer')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.removeCopyright')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.userResponsibilities')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.userResponsibilitiesText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.provideAccurateInfo')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.onlyListOwnedItems')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.noFalseListings')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.respectUsers')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.complyLaws')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.listingGuidelines')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.listingGuidelinesText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.accurateDescriptions')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.qualityPhotos')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.fairPrices')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.respondPromptly')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.updateStatus')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.prohibitedActivities')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.prohibitedActivitiesText')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.noIllegalItems')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.noSpam')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.noImpersonation')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>• {t('termsOfUse.noLawViolation')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.contentModeration')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.contentModerationText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.limitationOfLiability')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.limitationOfLiabilityText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.changesToTerms')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.changesToTermsText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('termsOfUse.contactInformation')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('termsOfUse.contactInformationText')}
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

