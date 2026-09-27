import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritesProvider } from '@/src/features/favorites/FavoritesProvider';
import { LocationProvider } from '@/src/features/location/LocationProvider';
import { colors } from '@/src/theme';

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
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <LocationProvider>
          <FavoritesProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerTintColor: colors.text,
                headerStyle: { backgroundColor: colors.background },
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="results" options={{ title: 'Résultats' }} />
              <Stack.Screen name="place/[id]" options={{ title: '' }} />
              <Stack.Screen name="favorites" options={{ title: 'Favoris' }} />
              <Stack.Screen name="route/[id]" options={{ title: 'Itinéraire' }} />
            </Stack>
          </FavoritesProvider>
        </LocationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
