import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { mapboxGuideAvailable } from '@/src/features/guide/available';

/** Guidage pas à pas à pied ou à vélo (Mapbox), ou guidage Google si Mapbox est absent. */
export default function GuideRoute() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    lat: string;
    lng: string;
    mode?: string;
    back?: string;
  }>();

  if (!mapboxGuideAvailable) {
    return <Redirect href={{ pathname: '/navigate/[id]', params }} />;
  }
  // Chargé seulement si Mapbox est présent : l'importer sans le module natif fait planter.
  const { GuideScreen } = require('@/src/features/guide/GuideScreen') as typeof import('@/src/features/guide/GuideScreen');
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
