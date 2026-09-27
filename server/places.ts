// Client minimal pour Google Places API (New). Utilisé uniquement côté serveur :
// la clé GOOGLE_PLACES_API_KEY n'est jamais envoyée à l'application.

import type { LatLng, OpeningStatus, PhotoRef, PriceLevel } from '@/shared/types';

const PLACES_BASE = 'https://places.googleapis.com/v1';

// Champs minimaux pour la liste. Les avis sont demandés seulement dans la fiche
// lieu (Place Details) : les inclure ici ferait passer chaque recherche dans la
// tranche de facturation la plus chère.
const TEXT_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours',
  'places.photos',
].join(',');

export class PlacesError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError('GOOGLE_PLACES_API_KEY manquante côté serveur', 500);
  return key;
}

// --- Types de la réponse Google (sous-ensemble utilisé) ---

interface GooglePhoto {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    nextOpenTime?: string;
    nextCloseTime?: string;
  };
  photos?: GooglePhoto[];
}

export interface RawPlace {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  opening?: OpeningStatus;
  photo?: PhotoRef;
}

export interface TextSearchParams {
  textQuery: string;
  center: LatLng;
  radiusMeters: number;
  includedType?: string;
  openNow?: boolean;
  minRating?: number;
  priceLevels?: PriceLevel[];
}

// --- Prix ---

const PRICE_FROM_GOOGLE: Record<string, PriceLevel> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const PRICE_TO_GOOGLE: Record<PriceLevel, string | undefined> = {
  0: undefined, // non accepté comme filtre par Text Search
  1: 'PRICE_LEVEL_INEXPENSIVE',
  2: 'PRICE_LEVEL_MODERATE',
  3: 'PRICE_LEVEL_EXPENSIVE',
  4: 'PRICE_LEVEL_VERY_EXPENSIVE',
};

// --- Horaires (fuseau de Lille) ---

const TIME_ZONE = 'Europe/Paris';

const hourFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'short' });
const dateKeyFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** « 23:00 » si c'est aujourd'hui (heure de Lille), sinon « mar. 12:00 ». */
export function formatLocalTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const time = hourFormat.format(date);
  if (dateKeyFormat.format(date) === dateKeyFormat.format(now)) return time;
  return `${dayFormat.format(date)} ${time}`;
}

export function toOpeningStatus(
  hours: GooglePlace['currentOpeningHours'],
  now: Date = new Date(),
): OpeningStatus | undefined {
  if (!hours || hours.openNow === undefined) return undefined;
  if (hours.openNow) {
    return {
      openNow: true,
      closesAt: hours.nextCloseTime ? formatLocalTime(hours.nextCloseTime, now) : undefined,
    };
  }
  return {
    openNow: false,
    opensAt: hours.nextOpenTime ? formatLocalTime(hours.nextOpenTime, now) : undefined,
  };
}

export function mapPlace(place: GooglePlace, now: Date = new Date()): RawPlace | null {
  if (!place.location || !place.displayName?.text) return null;
  const photo = place.photos?.[0];
  return {
    id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? '',
    location: { lat: place.location.latitude, lng: place.location.longitude },
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceLevel: place.priceLevel ? PRICE_FROM_GOOGLE[place.priceLevel] : undefined,
    opening: toOpeningStatus(place.currentOpeningHours, now),
    photo: photo
      ? {
          name: photo.name,
          attributions: (photo.authorAttributions ?? [])
            .filter((a) => a.displayName)
            .map((a) => ({ displayName: a.displayName!, uri: a.uri })),
        }
      : undefined,
  };
}

// --- Appels API ---

export async function textSearch(params: TextSearchParams): Promise<RawPlace[]> {
  const priceLevels = params.priceLevels
    ?.map((p) => PRICE_TO_GOOGLE[p])
    .filter((p): p is string => p !== undefined);

  const body = {
    textQuery: params.textQuery,
    languageCode: 'fr',
    regionCode: 'FR',
    pageSize: 20,
    locationBias: {
      circle: {
        center: { latitude: params.center.lat, longitude: params.center.lng },
        radius: params.radiusMeters,
      },
    },
    ...(params.includedType ? { includedType: params.includedType } : {}),
    ...(params.openNow ? { openNow: true } : {}),
    ...(params.minRating ? { minRating: params.minRating } : {}),
    ...(priceLevels?.length ? { priceLevels } : {}),
  };

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[places] Text Search a échoué', res.status, detail);
    // Même un 400 de Google (clé invalide, type inconnu…) est un problème serveur, pas client.
    throw new PlacesError('La recherche Google Places a échoué', 502);
  }

  const json = (await res.json()) as { places?: GooglePlace[] };
  const now = new Date();
  return (json.places ?? []).map((p) => mapPlace(p, now)).filter((p): p is RawPlace => p !== null);
}

/**
 * Renvoie l'URL temporaire (googleusercontent) d'une photo, sans exposer la clé.
 * `name` a la forme « places/{placeId}/photos/{photoId} ».
 */
export async function photoUri(name: string, maxWidthPx: number): Promise<string> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    throw new PlacesError('Référence de photo invalide', 400);
  }
  const url = new URL(`${PLACES_BASE}/${name}/media`);
  url.searchParams.set('maxWidthPx', String(maxWidthPx));
  url.searchParams.set('skipHttpRedirect', 'true');

  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey() } });
  if (!res.ok) {
    console.error('[places] Photo a échoué', res.status, await res.text());
    throw new PlacesError('Photo indisponible', res.status === 404 ? 404 : 502);
  }
  const json = (await res.json()) as { photoUri?: string };
  if (!json.photoUri) throw new PlacesError('Photo indisponible', 502);
  return json.photoUri;
}
