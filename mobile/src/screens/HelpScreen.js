import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getFlexDirection, getTextAlign } from '../utils/rtlStyles';

export default function HelpScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();

  const handleContactSupport = () => {
    // You can replace this with actual support email or phone
    Linking.openURL('mailto:support@telefonak.com?subject=Help Request');
  };

  const handleCallSupport = () => {
    // You can replace this with actual support phone number
    Linking.openURL('tel:+962790000000');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, getFlexDirection(isRTL, 'row')]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }, getTextAlign(isRTL, 'center')]}>{t('help.helpSupport')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.frequentlyAskedQuestions')}</Text>
          
          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.howToCreateListing')}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('help.howToCreateListingAnswer')}
            </Text>
          </View>

          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.howLongApproval')}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('help.howLongApprovalAnswer')}
            </Text>
          </View>

          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.canEditListing')}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('help.canEditListingAnswer')}
            </Text>
          </View>

          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.howToContactSeller')}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('help.howToContactSellerAnswer')}
            </Text>
          </View>

          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.listingDeclined')}</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }, getTextAlign(isRTL, 'auto')]}>
              {t('help.listingDeclinedAnswer')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.contactSupport')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('help.needMoreHelp')}
          </Text>

          <TouchableOpacity style={[styles.contactButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]} onPress={handleContactSupport}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
            <Text style={[styles.contactButtonText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.emailSupport')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.contactButton, { backgroundColor: colors.inputBackground }, getFlexDirection(isRTL, 'row')]} onPress={handleCallSupport}>
            <Ionicons name="call-outline" size={24} color={colors.primary} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
            <Text style={[styles.contactButtonText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.callSupport')}</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>{t('help.businessHours')}</Text>
          <Text style={[styles.sectionText, { color: colors.text }, getTextAlign(isRTL, 'auto')]}>
            {t('help.supportAvailable')}
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('help.businessHoursDays')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('help.businessHoursWeekend')}</Text>
          <Text style={[styles.bulletPoint, { color: colors.text }, getTextAlign(isRTL, 'auto'), { marginLeft: isRTL ? 0 : 16, marginRight: isRTL ? 16 : 0 }]}>{t('help.responseTime')}</Text>
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
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  faqItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  contactButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
});

