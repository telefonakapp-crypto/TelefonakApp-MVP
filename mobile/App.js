import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
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
import EditListingScreen from './src/screens/EditListingScreen';
import ListingDetailsScreen from './src/screens/ListingDetailsScreen';
import MyListingsScreen from './src/screens/MyListingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import UserGuideScreen from './src/screens/UserGuideScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfUseScreen from './src/screens/TermsOfUseScreen';
import HelpScreen from './src/screens/HelpScreen';
import SavedListingsScreen from './src/screens/SavedListingsScreen';
import MyOffersScreen from './src/screens/MyOffersScreen';
import ReceivedOffersScreen from './src/screens/ReceivedOffersScreen';
import ChangePhoneScreen from './src/screens/ChangePhoneScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      const startTime = Date.now();

      try {
        const onboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        const token = await AsyncStorage.getItem('authToken');

        setHasSeenOnboarding(onboarding === 'true');
        setIsAuthenticated(!!token);
      } catch (error) {
        console.error('Error checking auth status:', error);
      }

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2500 - elapsed);

      setTimeout(() => {
        setIsLoading(false);
      }, remainingTime);
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  const getInitialRoute = () => {
    if (!hasSeenOnboarding) return 'Onboarding';
    if (!isAuthenticated) return 'AuthChoice';
    return 'Home';
  };

  return (
    <LanguageProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <NotificationsProvider>
            <AppNavigatorWrapper initialRoute={getInitialRoute()} />
          </NotificationsProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function AppNavigatorWrapper({ initialRoute }) {
  const { isRTL } = useLanguage();

  const defaultScreenOptions = {
    headerShown: false,
    gestureDirection: isRTL ? 'horizontal-inverted' : 'horizontal',
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={defaultScreenOptions}
      >
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
          options={{ ...defaultScreenOptions, gestureEnabled: false }}
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
        <Stack.Screen name="EditListing" component={EditListingScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ListingDetails" component={ListingDetailsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="MyListings" component={MyListingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="UserGuide" component={UserGuideScreen} options={defaultScreenOptions} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={defaultScreenOptions} />
        <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} options={defaultScreenOptions} />
        <Stack.Screen name="Help" component={HelpScreen} options={defaultScreenOptions} />
        <Stack.Screen name="SavedListings" component={SavedListingsScreen} options={defaultScreenOptions} />
        <Stack.Screen name="MyOffers" component={MyOffersScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ReceivedOffers" component={ReceivedOffersScreen} options={defaultScreenOptions} />
        <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} options={defaultScreenOptions} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
