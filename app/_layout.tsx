import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces/600SemiBold_Italic';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdsProvider } from '@/src/features/ads/AdsProvider';
import { FavoritesProvider } from '@/src/features/favorites/FavoritesProvider';
import { LocationProvider } from '@/src/features/location/LocationProvider';
import { AppNavigationProvider } from '@/src/features/navigation/AppNavigationProvider';
import { colors, fonts } from '@/src/theme';

// L'écran de démarrage reste affiché le temps de charger la police de titre.
void SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
  });
  const ready = fontsLoaded || !!fontError; // sans police, on continue avec celle du système

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AppNavigationProvider>
          <LocationProvider>
            <FavoritesProvider>
              <AdsProvider>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerTintColor: colors.text,
                    headerStyle: { backgroundColor: colors.background },
                    headerTitleStyle: { fontFamily: fonts.displayMedium, fontSize: 19 },
                    headerShadowVisible: false,
                    animation: 'ios_from_right',
                    headerBackButtonDisplayMode: 'minimal',
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="results" options={{ title: 'Résultats' }} />
                  <Stack.Screen name="place/[id]" options={{ title: '' }} />
                  <Stack.Screen name="favorites" options={{ title: 'Favoris' }} />
                  <Stack.Screen name="route/[id]" options={{ title: 'Itinéraire' }} />
                  <Stack.Screen name="transit/[id]" options={{ title: 'En transports' }} />
                  <Stack.Screen
                    name="journey"
                    options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
                  />
                  <Stack.Screen
                    name="guide/[id]"
                    options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
                  />
                  <Stack.Screen name="offers" options={{ title: 'Bons plans' }} />
                  <Stack.Screen name="agenda" options={{ title: 'Agenda' }} />
                  <Stack.Screen name="event/[id]" options={{ title: '' }} />
                  <Stack.Screen name="admin" options={{ title: 'Espace partenaires' }} />
                  <Stack.Screen
                    name="navigate/[id]"
                    options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
                  />
                  <Stack.Screen
                    name="arrived/[id]"
                    options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
                  />
                </Stack>
              </AdsProvider>
            </FavoritesProvider>
          </LocationProvider>
        </AppNavigationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
