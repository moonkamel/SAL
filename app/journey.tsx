import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';

import { mapboxGuideAvailable } from '@/src/features/guide/available';
import { takePendingJourney } from '@/src/features/journey/journeyStore';

/** Voyage en plusieurs étapes (transports, V'Lille), enchaînées automatiquement. */
export default function JourneyRoute() {
  const [journey] = useState(takePendingJourney);
  if (!journey || !mapboxGuideAvailable) return <Redirect href="/" />;
  // Chargé seulement si Mapbox est présent dans l'app installée.
  const { JourneyScreen } = require('@/src/features/journey/JourneyScreen') as typeof import('@/src/features/journey/JourneyScreen');
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <JourneyScreen journey={journey} />
    </>
  );
}
