import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import appConfig from '../../app.json';
import { useLanguage } from '../context/LanguageContext';
import { getTextAlign } from '../utils/rtlStyles';
import {
  fetchMaintenanceStatus,
  exitMaintenanceMode,
} from '../utils/maintenance';
import { fonts, brand, radii } from '../utils/designTokens';

const APP_VERSION = appConfig?.expo?.version || '1.0.0';

export default function MaintenanceScreen() {
  const { t, isRTL } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setStatusNote('');
    try {
      const status = await fetchMaintenanceStatus();
      if (!status.maintenance) {
        await exitMaintenanceMode();
        return;
      }
      setStatusNote(status.message || t('maintenance.subtitle'));
    } catch (error) {
      setStatusNote(t('common.networkError'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/telefonak-app-icon-v5.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Telefonak"
          />
        </View>

        <Text style={[styles.title, getTextAlign(isRTL, 'center')]}>
          {t('maintenance.title')}
        </Text>
        <Text style={[styles.subtitle, getTextAlign(isRTL, 'center')]}>
          {t('maintenance.subtitle')}
        </Text>
        <Text style={[styles.body, getTextAlign(isRTL, 'center')]}>
          {t('maintenance.body')}
        </Text>

        <TouchableOpacity
          style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
          onPress={handleRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel={t('maintenance.refresh')}
        >
          {refreshing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.refreshText}>{t('maintenance.refresh')}</Text>
            </>
          )}
        </TouchableOpacity>

        {statusNote ? (
          <Text style={[styles.statusNote, getTextAlign(isRTL, 'center')]}>
            {statusNote}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.version, getTextAlign(isRTL, 'center')]}>
        {`${t('maintenance.versionLabel')} ${APP_VERSION}`}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: brand.onSurface,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: fonts.headline,
    fontSize: 17,
    color: brand.secondary,
    marginBottom: 10,
    lineHeight: 24,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: brand.secondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  refreshButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.xl,
    minWidth: 160,
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshText: {
    fontFamily: fonts.labelBold,
    color: '#ffffff',
    fontSize: 16,
  },
  statusNote: {
    fontFamily: fonts.body,
    marginTop: 16,
    fontSize: 14,
    color: brand.secondary,
    lineHeight: 20,
  },
  version: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#7a848c',
    paddingBottom: 16,
  },
});
