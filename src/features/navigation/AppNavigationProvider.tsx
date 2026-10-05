import {
  NavigationProvider,
  TaskRemovedBehavior,
} from '@googlemaps/react-native-navigation-sdk';
import type { ReactNode } from 'react';
import { useColors } from '@/src/theme/tone';


/** Contexte du Navigation SDK, avec la boîte de dialogue des conditions Google en français. */
export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <NavigationProvider
      termsAndConditionsDialogOptions={{
        title: 'Conditions d’utilisation du guidage',
        companyName: 'Sortir à Lille',
        showOnlyDisclaimer: false,
        uiParams: {
          backgroundColor: colors.surface,
          titleColor: colors.text,
          mainTextColor: colors.textMuted,
          acceptButtonTextColor: colors.accent,
          cancelButtonTextColor: colors.textMuted,
        },
      }}
      // Si l'utilisateur ferme l'app depuis les applis récentes, on arrête le guidage.
      taskRemovedBehavior={TaskRemovedBehavior.QUIT_SERVICE}
    >
      {children}
    </NavigationProvider>
  );
}
