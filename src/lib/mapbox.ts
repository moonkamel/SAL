// Itinéraires Mapbox Directions (à pied, à vélo), appelés depuis l'app avec le jeton
// PUBLIC Mapbox (pk.…), prévu pour être embarqué dans une application.

import { type GuideRoute, parseMapboxRoute } from '@/shared/guide';
import type { LatLng } from '@/shared/types';

export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

export type GuideMode = 'walk' | 'bicycle';

const PROFILE: Record<GuideMode, string> = { walk: 'walking', bicycle: 'cycling' };

export class MapboxRouteError extends Error {}

export async function getGuideRoute(
  from: LatLng,
  to: LatLng,
  mode: GuideMode,
  signal?: AbortSignal,
): Promise<GuideRoute> {
  if (!MAPBOX_TOKEN) throw new MapboxRouteError('Jeton Mapbox manquant (EXPO_PUBLIC_MAPBOX_TOKEN).');
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const q = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'fr',
    voice_instructions: 'true',
    banner_instructions: 'true',
    voice_units: 'metric',
  });
  let res: Response;
  try {
    res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${PROFILE[mode]}/${coords}?${q}`, {
      signal,
    });
  } catch {
    throw new MapboxRouteError('Connexion impossible. Vérifiez votre réseau.');
  }
  if (res.status === 401) throw new MapboxRouteError('Jeton Mapbox refusé.');
  if (!res.ok) throw new MapboxRouteError('Itinéraire indisponible pour le moment.');
  const route = parseMapboxRoute(await res.json());
  if (!route) throw new MapboxRouteError('Aucun itinéraire trouvé.');
  return route;
}
