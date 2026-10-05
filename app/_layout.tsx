import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces/600SemiBold_Italic';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdsProvider } from '@/src/features/ads/AdsProvider';
import { useDaytime } from '@/src/features/moment/useDaytime';
import { FavoritesProvider } from '@/src/features/favorites/FavoritesProvider';
import { LocationProvider } from '@/src/features/location/LocationProvider';
import { AppNavigationProvider } from '@/src/features/navigation/AppNavigationProvider';
import { LanguageProvider, useI18n } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { LanguagePicker } from '@/src/i18n/LanguagePicker';
import { fonts } from '@/src/theme';
import { type Tone, TONES, ToneProvider, useColors, useTone } from '@/src/theme/tone';

// L'écran de démarrage reste affiché le temps de charger la police de titre.
void SplashScreen.preventAutoHideAsync();

/** Thème de la navigation (en-têtes, fonds) aux couleurs de la tonalité. */
function navigationTheme(tone: Tone) {
  const c = TONES[tone];
  const base = tone === 'day' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.background,
      card: c.background,
      text: c.text,
      primary: c.accent,
      border: c.border,
    },
  };
}

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

  // Tonalité jour (6 h – 19 h) ou nuit, pour tous les écrans ; suit l'heure qui passe.
  const tone: Tone = useDaytime() ? 'day' : 'night';

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ToneProvider value={tone}>
          <ThemeProvider value={navigationTheme(tone)}>
            <AppWithLanguage />
          </ThemeProvider>
        </ToneProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

/** Au premier lancement : choix de la langue (mémorisé), puis l'app. */
function AppWithLanguage() {
  const colors = useColors();
  const { ready, chosen, t } = useI18n();
  const statusBar = useTone().tone === 'day' ? 'dark' : 'light';
  // Statistiques anonymes : ouverture de l'app et écrans vus (« /place/[id] », jamais l'identifiant).
  const segments = useSegments();
  const screen = `/${segments.join('/')}`;
  useEffect(() => {
    if (ready) track('app_open');
  }, [ready]);
  useEffect(() => {
    if (ready && chosen) track('screen', { screen });
  }, [ready, chosen, screen]);
  const pathname = usePathname();
  if (!ready) return null;
  // La politique de confidentialité s'ouvre directement (lien depuis Google Play).
  if (!chosen && pathname !== '/privacy') {
    return (
      <>
        <StatusBar style={statusBar} />
        <LanguagePicker />
      </>
    );
  }

  return (
    <AppNavigationProvider>
      <LocationProvider>
        <FavoritesProvider>
          <AdsProvider>
            <StatusBar style={statusBar} />
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
              <Stack.Screen name="results" options={{ title: t('Résultats') }} />
              <Stack.Screen name="place/[id]" options={{ title: '' }} />
              <Stack.Screen name="favorites" options={{ title: t('Favoris') }} />
              <Stack.Screen name="route/[id]" options={{ title: t('Itinéraire') }} />
              <Stack.Screen name="transit/[id]" options={{ title: t('En transports') }} />
              <Stack.Screen name="offers" options={{ title: t('Bons plans') }} />
              <Stack.Screen name="agenda" options={{ title: t('Agenda') }} />
              <Stack.Screen name="event/[id]" options={{ title: '' }} />
              <Stack.Screen name="admin" options={{ title: 'Espace partenaires' }} />
              <Stack.Screen name="privacy" options={{ title: 'Confidentialité' }} />
              <Stack.Screen
                name="language"
                options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
              />
            </Stack>
          </AdsProvider>
        </FavoritesProvider>
      </LocationProvider>
    </AppNavigationProvider>
  );
}
