import { Stack, useLocalSearchParams } from 'expo-router';

import { GuidanceScreen } from '@/src/features/navigation/GuidanceScreen';
import { isGuidable } from '@/src/features/navigation/messages';
import type { TravelMode } from '@/shared/types';

export default function NavigateScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    lat: string;
    lng: string;
    mode: TravelMode;
  }>();
  const mode = params.mode && isGuidable(params.mode) ? params.mode : 'walk';

  return (
    <>
      {/* Plein écran, sans geste de retour : on quitte via « Arrêter ». */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <GuidanceScreen
        placeId={params.id}
        name={params.name ?? 'Destination'}
        destination={{ lat: Number(params.lat), lng: Number(params.lng) }}
        mode={mode as Exclude<TravelMode, 'transit'>}
      />
    </>
  );
}
