import { Stack, useLocalSearchParams } from 'expo-router';

import { GuideScreen } from '@/src/features/guide/GuideScreen';

/** Guidage pas à pas à pied ou à vélo (Mapbox). */
export default function GuideRoute() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    lat: string;
    lng: string;
    mode?: string;
    back?: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <GuideScreen
        placeId={params.id}
        name={params.name ?? 'Destination'}
        destination={{ lat: Number(params.lat), lng: Number(params.lng) }}
        mode={params.mode === 'bicycle' ? 'bicycle' : 'walk'}
        returnOnArrival={params.back === '1'}
      />
    </>
  );
}
