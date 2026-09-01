import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { OffersUnreadProvider } from './src/context/OffersUnreadContext';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthChoiceScreen from './src/screens/AuthChoiceScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpPhoneScreen from './src/screens/SignUpPhoneScreen';
import OTPScreen from './src/screens/OTPScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CreateListingScreen from './src/screens/CreateListingScreen';
import ListingDetailsScreen from './src/screens/ListingDetailsScreen';
import MyListingsScreen from './src/screens/MyListingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import UserGuideScreen from './src/screens/UserGuideScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfUseScreen from './src/screens/TermsOfUseScreen';
import HelpScreen from './src/screens/HelpScreen';
import ContactUsScreen from './src/screens/ContactUsScreen';
import SavedListingsScreen from './src/screens/SavedListingsScreen';
import MyOffersScreen from './src/screens/MyOffersScreen';
import ReceivedOffersScreen from './src/screens/ReceivedOffersScreen';
import OffersScreen from './src/screens/OffersScreen';
import ChangePhoneScreen from './src/screens/ChangePhoneScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import ImagePickerDiagnosticScreen from './src/screens/ImagePickerDiagnosticScreen';
import { ToastHost } from './src/utils/toast';
import { resolveStoredSession } from './src/utils/authSession';
import { ensureNativeLayoutIsLTR } from './src/utils/layoutDirection';
import {
  fetchMaintenanceStatus,
  markMaintenanceActive,
  setMaintenanceNavigationRef,
} from './src/utils/maintenance';
import {
  hydrateContactSettingsCache,
  refreshContactSettings,
} from './src/utils/contactSettings';
// Side-effect: attach maintenance interceptors to apiClient + default axios.
import './src/utils/api';

const Stack = createStackNavigator();
const SPLASH_MIN_MS = 2500;

/**
 * Atomic cold-start snapshot. Navigation must not mount until this is set,
 * otherwise initialRouteName can lock onto AuthChoice while sessionKind is
 * still the default "none" (race with splash timer / Strict Mode remounts).
 *
 * @typedef {{
 *   hasSeenOnboarding: boolean,
 *   sessionKind: 'none'|'customer'|'registration',
 *   registrationToken: string|null,
 *   maintenance: boolean,
 * }} AppBootState
 */

export default function App() {
  /** @type {[AppBootState|null, function]} */
  const [boot, setBoot] = useState(null);

  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    let cancelled = false;
    let splashTimer = null;

    const initializeApp = async () => {
      const startTime = Date.now();

      try {
        // Resolve layout before showing UI. May reload the JS runtime once.
        const { reloaded } = await ensureNativeLayoutIsLTR();
        if (reloaded || cancelled) return;

        const onboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        const session = await resolveStoredSession();

        // Restore last-known support contacts, then refresh from Admin Settings.
        await hydrateContactSettingsCache();
        refreshContactSettings().catch(() => {});

        let maintenance = false;
        try {
          const status = await fetchMaintenanceStatus();
          maintenance = status.maintenance === true;
        } catch (statusError) {
          // Fail open on network errors — interceptor will catch later if needed.
          maintenance = false;
        }

        if (cancelled) return;

        // Arm the silent gate before any authenticated screen can fire API calls.
        if (maintenance) {
          markMaintenanceActive();
        }

        /** @type {AppBootState} */
        const nextBoot = {
          hasSeenOnboarding: onboarding === 'true',
          sessionKind: session.kind,
          registrationToken:
            session.kind === 'registration' ? session.token : null,
          maintenance,
        };

        const remainingTime = Math.max(0, SPLASH_MIN_MS - (Date.now() - startTime));
        splashTimer = setTimeout(() => {
          if (!cancelled) {
            // Single atomic commit — route + session agree on first paint.
            setBoot(nextBoot);
          }
        }, remainingTime);
      } catch (error) {
        console.error('Error checking auth status:', error);
        if (!cancelled) {
          setBoot({
            hasSeenOnboarding: false,
            sessionKind: 'none',
            registrationToken: null,
            maintenance: false,
          });
        }
      }
    };

    initializeApp();

    return () => {
      cancelled = true;
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, []);

  if (!boot || !fontsLoaded) {
    return <SplashScreen fontReady={fontsLoaded} />;
  }

  const initialRoute = boot.maintenance
    ? 'Maintenance'
    : !boot.hasSeenOnboarding
      ? 'Onboarding'
      : boot.sessionKind === 'customer'
        ? 'Home'
        : 'AuthChoice';

  return (
    <LanguageProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <NotificationsProvider>
            <OffersUnreadProvider>
              <AppNavigatorWrapper
                initialRoute={initialRoute}
                registrationToken={boot.registrationToken}
              />
              <ToastHost />
            </OffersUnreadProvider>
          </NotificationsProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function AppNavigatorWrapper({ initialRoute, registrationToken }) {
  const { isRTL } = useLanguage();

  const defaultScreenOptions = {
    headerShown: false,
    gestureDirection: isRTL ? 'horizontal-inverted' : 'horizontal',
  };

  return (
    <NavigationContainer
      ref={(ref) => {
        setMaintenanceNavigationRef(ref);
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={defaultScreenOptions}
      >
        <Stack.Screen
          name="Maintenance"
          component={MaintenanceScreen}
          options={{
            ...defaultScreenOptions,
            gestureEnabled: false,
            headerLeft: null,
          }}
        />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUpPhone" component={SignUpPhoneScreen} />
        <Stack.Screen
          name="OTP"
          component={OTPScreen}
          options={{ ...defaultScreenOptions, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ ...defaultScreenOptions, gestureEnabled: true }}
          initialParams={
            registrationToken ? { token: registrationToken } : undefined
          }
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            ...defaultScreenOptions,
            gestureEnabled: false,
            headerLeft: null,
          }}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} options={defaultScreenOptions} />
        <Stack.Screen name="CreateListing" component={CreateListingScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ListingDetails" component={ListingDetailsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="MyListings" component={MyListingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="UserGuide" component={UserGuideScreen} options={defaultScreenOptions} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={defaultScreenOptions} />
        <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Help" component={HelpScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ContactUs" component={ContactUsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="SavedListings" component={SavedListingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Offers" component={OffersScreen} options={defaultScreenOptions} />
        <Stack.Screen name="MyOffers" component={MyOffersScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ReceivedOffers" component={ReceivedOffersScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} options={defaultScreenOptions} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={defaultScreenOptions} />
        <Stack.Screen
          name="ImagePickerDiagnostic"
          component={ImagePickerDiagnosticScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
