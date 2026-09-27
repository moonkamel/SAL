// Client minimal pour Google Routes API (computeRoutes), côté serveur uniquement.
// Sert à l'aperçu d'itinéraire ; le guidage lui-même passe par le Navigation SDK.

import { haversineMeters } from '@/shared/geo';
import type { LatLng, RouteOption, TravelMode } from '@/shared/types';

import { PlacesError } from './places';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Champs de base uniquement (tranche « Essentials ») : pas de trafic en temps réel.
const FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
].join(',');

const GOOGLE_MODE: Record<TravelMode, string> = {
  walk: 'WALK',
  bicycle: 'BICYCLE',
  drive: 'DRIVE',
  transit: 'TRANSIT',
};

export const TRAVEL_MODES: TravelMode[] = ['walk', 'bicycle', 'drive', 'transit'];

/** Au-delà, ce n'est plus une sortie à Lille : on refuse pour limiter les abus. */
export const MAX_ROUTE_METERS = 100_000;

const VEHICLE_LABEL: Record<string, string> = {
  SUBWAY: 'Métro',
  METRO_RAIL: 'Métro',
  TRAM: 'Tram',
  LIGHT_RAIL: 'Tram',
  BUS: 'Bus',
  HEAVY_RAIL: 'Train',
  RAIL: 'Train',
};

interface GoogleRoute {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  legs?: {
    steps?: {
      transitDetails?: {
        transitLine?: { nameShort?: string; name?: string; vehicle?: { type?: string } };
      };
    }[];
  }[];
}

/** « Métro 1 », « Tram R », « Bus L1 » — dans l'ordre du trajet, sans doublon. */
export function transitLines(route: GoogleRoute): string[] {
  const lines: string[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const line = step.transitDetails?.transitLine;
      if (!line) continue;
      const vehicle = VEHICLE_LABEL[line.vehicle?.type ?? ''] ?? '';
      const label = [vehicle, line.nameShort ?? line.name].filter(Boolean).join(' ');
      if (label && !lines.includes(label)) lines.push(label);
    }
  }
  return lines;
}

export function mapRoute(mode: TravelMode, route: GoogleRoute | undefined): RouteOption {
  const seconds = route?.duration ? Number.parseInt(route.duration, 10) : NaN;
  if (!route || !route.polyline?.encodedPolyline || Number.isNaN(seconds)) {
    return { mode, available: false };
  }
  return {
    mode,
    available: true,
    durationSeconds: seconds,
    distanceMeters: route.distanceMeters ?? 0,
    polyline: route.polyline.encodedPolyline,
    ...(mode === 'transit' ? { transitLines: transitLines(route) } : {}),
  };
}

async function computeRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteOption> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError('GOOGLE_PLACES_API_KEY manquante côté serveur', 500);

  const res = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: GOOGLE_MODE[mode],
      languageCode: 'fr',
      regionCode: 'FR',
      units: 'METRIC',
    }),
  });

  if (!res.ok) {
    // Un mode indisponible (ex. vélo non couvert) ne doit pas faire échouer les autres.
    console.warn(`[routes] ${mode} a échoué`, res.status, await res.text());
    if (res.status === 403) throw new PlacesError('Routes API non activée pour cette clé', 502);
    return { mode, available: false };
  }
  const json = (await res.json()) as { routes?: GoogleRoute[] };
  return mapRoute(mode, json.routes?.[0]);
}

/** Calcule les itinéraires pour tous les modes en parallèle. */
export async function computeAllRoutes(from: LatLng, to: LatLng): Promise<RouteOption[]> {
  if (haversineMeters(from, to) > MAX_ROUTE_METERS) {
    throw new PlacesError('Destination trop éloignée', 400);
  }
  return Promise.all(TRAVEL_MODES.map((mode) => computeRoute(from, to, mode)));
}
