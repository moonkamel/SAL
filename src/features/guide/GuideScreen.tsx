import { useMemo } from 'react';

import { JourneyScreen } from '@/src/features/journey/JourneyScreen';
import type { GuideMode } from '@/src/lib/mapbox';
import type { Journey } from '@/shared/journey';
import type { LatLng } from '@/shared/types';

interface Props {
  placeId: string;
  name: string;
  destination: LatLng;
  mode: GuideMode;
  returnOnArrival?: boolean;
}

/** Guidage simple à pied ou à vélo : un voyage d'une seule étape. */
export function GuideScreen({ placeId, name, destination, mode, returnOnArrival }: Props) {
  const journey = useMemo<Journey>(
    () => ({
      placeId,
      destinationName: name,
      legs: [{ kind: mode === 'bicycle' ? 'bike' : 'walk', to: destination, toName: name }],
    }),
    [placeId, name, destination.lat, destination.lng, mode],
  );
  return <JourneyScreen journey={journey} returnOnArrival={returnOnArrival} />;
}
