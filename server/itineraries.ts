// Trajets détaillés en transports en commun (Google Routes API, mode TRANSIT) :
// lignes, couleurs, arrêts, horaires, nombre d'arrêts et tarif, avec alternatives.

import { haversineMeters } from '@/shared/geo';
import type { LatLng, TransitItinerary, TripSegment } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';
import { MAX_ROUTE_METERS } from './routes';
import { tx } from '@/shared/i18n';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.localizedValues.transitFare',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.startLocation',
  'routes.legs.steps.endLocation',
  'routes.legs.steps.transitDetails',
].join(',');

const VEHICLE_LABEL: Record<string, string> = {
  SUBWAY: tx('Métro'),
  METRO_RAIL: tx('Métro'),
  TRAM: tx('Tram'),
  LIGHT_RAIL: tx('Tram'),
  BUS: tx('Bus'),
  TROLLEYBUS: tx('Bus'),
  HEAVY_RAIL: tx('Train'),
  RAIL: tx('Train'),
  COMMUTER_TRAIN: tx('Train'),
  HIGH_SPEED_TRAIN: tx('Train'),
};

interface GLatLng {
  latLng?: { latitude?: number; longitude?: number };
}

interface GStep {
  travelMode?: string;
  staticDuration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  startLocation?: GLatLng;
  endLocation?: GLatLng;
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string; location?: GLatLng };
      arrivalStop?: { name?: string; location?: GLatLng };
      departureTime?: string;
      arrivalTime?: string;
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      vehicle?: { type?: string; name?: { text?: string } };
    };
  };
}

export interface GRoute {
  duration?: string;
  distanceMeters?: number;
  localizedValues?: { transitFare?: { text?: string } };
  legs?: { steps?: GStep[] }[];
}

const seconds = (d?: string) => (d ? Number.parseInt(d, 10) || 0 : 0);

function point(l?: GLatLng): LatLng | null {
  const lat = l?.latLng?.latitude;
  const lng = l?.latLng?.longitude;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

/** Couleur #RRGGBB valide, sinon la couleur par défaut. */
function hex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

/**
 * Transforme un itinéraire Google en tronçons : les pas de marche consécutifs sont
 * fusionnés en un seul tronçon « à pied jusqu'à … ».
 */
export function mapItinerary(
  route: GRoute,
  destinationName: string,
  now: Date = new Date(),
): TransitItinerary | null {
  const steps = route.legs?.flatMap((l) => l.steps ?? []) ?? [];
  const segments: TripSegment[] = [];
  let walk: { duration: number; distance: number; polylines: string[]; from: LatLng; to: LatLng } | null =
    null;

  const flushWalk = (toName: string) => {
    if (!walk) return;
    if (walk.distance > 0 || walk.duration > 0) {
      segments.push({
        kind: 'walk',
        durationSeconds: walk.duration,
        distanceMeters: walk.distance,
        polyline: walk.polylines.join(' '), // l'espace n'apparaît jamais dans un tracé encodé
        from: walk.from,
        to: walk.to,
        toName,
      });
    }
    walk = null;
  };

  for (const step of steps) {
    const td = step.transitDetails;
    if (step.travelMode === 'TRANSIT' && td) {
      const dep = td.stopDetails?.departureStop;
      const arr = td.stopDetails?.arrivalStop;
      const depLoc = point(dep?.location) ?? point(step.startLocation);
      const arrLoc = point(arr?.location) ?? point(step.endLocation);
      const line = td.transitLine;
      if (!depLoc || !arrLoc || !line || !td.stopDetails?.departureTime || !td.stopDetails.arrivalTime) {
        return null;
      }
      flushWalk(dep?.name ?? 'l’arrêt');
      const vehicle = VEHICLE_LABEL[line.vehicle?.type ?? ''] ?? line.vehicle?.name?.text ?? 'Ligne';
      segments.push({
        kind: 'ride',
        line: {
          short: line.nameShort ?? line.name ?? '?',
          name: line.name ?? line.nameShort ?? '',
          color: hex(line.color, '#E6B45A'),
          textColor: hex(line.textColor, '#0A0D1C'),
          vehicle,
        },
        headsign: td.headsign ?? '',
        departureStop: { name: dep?.name ?? 'Arrêt', location: depLoc },
        arrivalStop: { name: arr?.name ?? 'Arrêt', location: arrLoc },
        departureTime: td.stopDetails.departureTime,
        arrivalTime: td.stopDetails.arrivalTime,
        stopCount: td.stopCount ?? 0,
        durationSeconds: seconds(step.staticDuration),
        polyline: step.polyline?.encodedPolyline ?? '',
      });
    } else {
      const from = point(step.startLocation);
      const to = point(step.endLocation);
      if (!from || !to) continue;
      walk ??= { duration: 0, distance: 0, polylines: [], from, to };
      walk.duration += seconds(step.staticDuration);
      walk.distance += step.distanceMeters ?? 0;
      walk.to = to;
      if (step.polyline?.encodedPolyline) walk.polylines.push(step.polyline.encodedPolyline);
    }
  }
  flushWalk(destinationName);

  const rides = segments.filter((s): s is Extract<TripSegment, { kind: 'ride' }> => s.kind === 'ride');
  if (rides.length === 0) return null; // tout à pied : l'écran « à pied » s'en charge

  // Horaires : départ = heure du 1er véhicule moins la marche qui précède.
  const firstRide = rides[0]!;
  const lastRide = rides[rides.length - 1]!;
  const walkBefore = segments
    .slice(0, segments.indexOf(firstRide))
    .reduce((t, s) => t + s.durationSeconds, 0);
  const walkAfter = segments
    .slice(segments.indexOf(lastRide) + 1)
    .reduce((t, s) => t + s.durationSeconds, 0);
  const departure = new Date(Date.parse(firstRide.departureTime) - walkBefore * 1000);
  const arrival = new Date(Date.parse(lastRide.arrivalTime) + walkAfter * 1000);
  const start = departure < now ? now : departure;

  return {
    id: rides.map((r) => `${r.line.short}@${r.departureTime}`).join('+'),
    departureTime: departure.toISOString(),
    arrivalTime: arrival.toISOString(),
    durationSeconds: Math.max(0, Math.round((arrival.getTime() - start.getTime()) / 1000)),
    walkMeters: segments.reduce((m, s) => m + (s.kind === 'walk' ? s.distanceMeters : 0), 0),
    fare: route.localizedValues?.transitFare?.text,
    segments,
  };
}

/** Mêmes lignes depuis les mêmes arrêts : c'est le même trajet, à une autre heure. */
function routeSignature(i: TransitItinerary): string {
  return i.segments
    .map((s) => (s.kind === 'ride' ? `${s.line.short}:${s.departureStop.name}>${s.arrivalStop.name}` : ''))
    .filter(Boolean)
    .join('|');
}

function firstDeparture(i: TransitItinerary): string {
  for (const s of i.segments) if (s.kind === 'ride') return s.departureTime;
  return i.departureTime;
}

/**
 * Par heure d'arrivée, sans doublon. Les départs suivants d'un même trajet sont
 * regroupés dans une seule proposition (« puis 12:50, 12:52 »).
 */
export function pickItineraries(list: (TransitItinerary | null)[]): TransitItinerary[] {
  const seen = new Set<string>();
  const sorted = list
    .filter((i): i is TransitItinerary => i !== null)
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime));

  const groups = new Map<string, TransitItinerary>();
  for (const it of sorted) {
    const sig = routeSignature(it);
    const head = groups.get(sig);
    if (!head) groups.set(sig, { ...it });
    else if ((head.nextDepartures?.length ?? 0) < 3) {
      head.nextDepartures = [...(head.nextDepartures ?? []), firstDeparture(it)];
    }
  }
  return [...groups.values()].slice(0, 4);
}

// Horaires : une minute de cache suffit, les départs changent vite.
const cache = new TtlCache<TransitItinerary[]>(60_000, 300);

export async function transitItineraries(
  from: LatLng,
  to: LatLng,
  destinationName: string,
): Promise<TransitItinerary[]> {
  if (haversineMeters(from, to) > MAX_ROUTE_METERS) {
    throw new PlacesError(tx('Destination trop éloignée'), 400);
  }
  const key = [from.lat, from.lng, to.lat, to.lng].map((v) => v.toFixed(4)).join(',');
  const hit = cache.get(key);
  if (hit) return hit;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new PlacesError(tx('GOOGLE_PLACES_API_KEY manquante côté serveur'), 500);

  const res = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: true,
      languageCode: 'fr',
      regionCode: 'FR',
      units: 'METRIC',
    }),
  });
  if (!res.ok) {
    console.error('[itineraries] Routes API', res.status, await res.text());
    throw new PlacesError(tx('Trajets en transports indisponibles'), 502);
  }
  const json = (await res.json()) as { routes?: GRoute[] };
  const itineraries = pickItineraries((json.routes ?? []).map((r) => mapItinerary(r, destinationName)));
  cache.set(key, itineraries);
  return itineraries;
}
