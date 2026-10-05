// Client minimal pour Google Places API (New). Utilisé uniquement côté serveur :
// la clé GOOGLE_PLACES_API_KEY n'est jamais envoyée à l'application.

import type {
  Ambiance,
  LatLng,
  OpeningStatus,
  PhotoRef,
  PlaceDetails,
  PriceLevel,
  Review,
} from '@/shared/types';
import { type Lang, LANG_INFO, tx } from '@/shared/i18n';
import { TtlCache } from './cache';

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

// Fiche lieu : ajoute les avis (tranche « Atmosphere »), les horaires de la semaine
// et les contacts. Appelé seulement quand l'utilisateur ouvre une fiche.
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'currentOpeningHours',
  'photos',
  'reviews',
  'nationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'outdoorSeating',
  'liveMusic',
  'goodForGroups',
  'goodForChildren',
  'servesCocktails',
  'servesVegetarianFood',
  'accessibilityOptions',
  'types',
].join(',');

// Résumé pour la liste des favoris : pas d'avis, donc moins cher.
const SUMMARY_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'currentOpeningHours',
  'photos',
].join(',');

/** Correspondance ambiance → champ booléen Google Places (tranche « Atmosphere »). */
export const AMBIANCE_FIELDS: Record<Ambiance, keyof GooglePlace> = {
  terrace: 'outdoorSeating',
  liveMusic: 'liveMusic',
  groups: 'goodForGroups',
  kids: 'goodForChildren',
  cocktails: 'servesCocktails',
  vegetarian: 'servesVegetarianFood',
  accessible: 'accessibilityOptions',
};

/** Lecture de la valeur Google pour une ambiance (l'accessibilité est un objet imbriqué). */
function ambianceValue(place: GooglePlace, a: Ambiance): boolean | undefined {
  if (a === 'accessible') return place.accessibilityOptions?.wheelchairAccessibleEntrance;
  return place[AMBIANCE_FIELDS[a]] as boolean | undefined;
}

/** Masque Text Search : les champs d'ambiance ne sont demandés que s'ils sont filtrés. */
export function textSearchFieldMask(ambiance: Ambiance[] = []): string {
  if (ambiance.length === 0) return TEXT_SEARCH_FIELD_MASK;
  const extra = [...new Set(ambiance.map((a) => `places.${AMBIANCE_FIELDS[a]}`))];
  return [TEXT_SEARCH_FIELD_MASK, ...extra].join(',');
}

const MAX_DETAIL_PHOTOS = 6;
const MAX_REVIEWS = 3;

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
  if (!key) throw new PlacesError(tx('GOOGLE_PLACES_API_KEY manquante côté serveur'), 500);
  return key;
}

// --- Types de la réponse Google (sous-ensemble utilisé) ---

interface GooglePhoto {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

interface GoogleReview {
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
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
    weekdayDescriptions?: string[];
  };
  photos?: GooglePhoto[];
  reviews?: GoogleReview[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  goodForGroups?: boolean;
  goodForChildren?: boolean;
  servesCocktails?: boolean;
  servesVegetarianFood?: boolean;
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleSeating?: boolean;
    wheelchairAccessibleRestroom?: boolean;
  };
  types?: string[];
}

/** Ambiances que Google confirme (valeur `true`) pour ce lieu. */
export function ambianceOf(place: GooglePlace): Ambiance[] {
  return (Object.keys(AMBIANCE_FIELDS) as Ambiance[]).filter(
    (a) => ambianceValue(place, a) === true,
  );
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
  ambiance?: Ambiance[];
}

export interface TextSearchParams {
  textQuery: string;
  center: LatLng;
  radiusMeters: number;
  includedType?: string;
  openNow?: boolean;
  minRating?: number;
  priceLevels?: PriceLevel[];
  ambiance?: Ambiance[];
  /** Langue des noms, adresses et horaires renvoyés. */
  lang?: Lang;
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
const dayFormats = new Map<Lang, Intl.DateTimeFormat>();
function dayFormat(lang: Lang): Intl.DateTimeFormat {
  let f = dayFormats.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(LANG_INFO[lang].locale, { timeZone: TIME_ZONE, weekday: 'short' });
    dayFormats.set(lang, f);
  }
  return f;
}
const dateKeyFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** « 23:00 » si c'est aujourd'hui (heure de Lille), sinon « mar. 12:00 ». */
export function formatLocalTime(iso: string, now: Date = new Date(), lang: Lang = 'fr'): string {
  const date = new Date(iso);
  const time = hourFormat.format(date);
  if (dateKeyFormat.format(date) === dateKeyFormat.format(now)) return time;
  // Fermeture dans la nuit (minuit, 2 h…) : « ferme à 02:00 », pas « sam. 02:00 ».
  const hours = (date.getTime() - now.getTime()) / 3_600_000;
  if (hours > 0 && hours < 12 && Number.parseInt(time, 10) < 6) return time;
  return `${dayFormat(lang).format(date)} ${time}`;
}

export function toOpeningStatus(
  hours: GooglePlace['currentOpeningHours'],
  now: Date = new Date(),
  lang: Lang = 'fr',
): OpeningStatus | undefined {
  if (!hours || hours.openNow === undefined) return undefined;
  if (hours.openNow) {
    return {
      openNow: true,
      closesAt: hours.nextCloseTime ? formatLocalTime(hours.nextCloseTime, now, lang) : undefined,
    };
  }
  return {
    openNow: false,
    opensAt: hours.nextOpenTime ? formatLocalTime(hours.nextOpenTime, now, lang) : undefined,
  };
}

function mapPhoto(photo: GooglePhoto): PhotoRef {
  return {
    name: photo.name,
    attributions: (photo.authorAttributions ?? [])
      .filter((a) => a.displayName)
      .map((a) => ({ displayName: a.displayName!, uri: a.uri })),
  };
}

/** Les avis les plus récents d'abord, limités à MAX_REVIEWS, sans avis vides. */
export function pickRecentReviews(reviews: GoogleReview[] | undefined): Review[] {
  return (reviews ?? [])
    .filter((r) => r.authorAttribution?.displayName && (r.text?.text || r.originalText?.text))
    .sort((a, b) => (b.publishTime ?? '').localeCompare(a.publishTime ?? ''))
    .slice(0, MAX_REVIEWS)
    .map((r) => ({
      authorName: r.authorAttribution!.displayName!,
      authorUri: r.authorAttribution!.uri,
      authorPhotoUri: r.authorAttribution!.photoUri,
      rating: r.rating ?? 0,
      relativeTime: r.relativePublishTimeDescription ?? '',
      publishTime: r.publishTime,
      text: (r.text?.text ?? r.originalText?.text)!,
    }));
}

export function mapPlace(place: GooglePlace, now: Date = new Date(), lang: Lang = 'fr'): RawPlace | null {
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
    opening: toOpeningStatus(place.currentOpeningHours, now, lang),
    photo: photo ? mapPhoto(photo) : undefined,
    ambiance: ambianceOf(place),
  };
}

export function mapDetails(
  place: GooglePlace,
  now: Date = new Date(),
  lang: Lang = 'fr',
): PlaceDetails | null {
  const base = mapPlace(place, now, lang);
  if (!base) return null;
  const { photo: _photo, ...rest } = base;
  return {
    ...rest,
    weekdayHours: place.currentOpeningHours?.weekdayDescriptions,
    photos: (place.photos ?? []).slice(0, MAX_DETAIL_PHOTOS).map(mapPhoto),
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    reviews: pickRecentReviews(place.reviews),
    types: place.types,
  };
}

// --- Appels API ---

export async function textSearch(params: TextSearchParams): Promise<RawPlace[]> {
  const priceLevels = params.priceLevels
    ?.map((p) => PRICE_TO_GOOGLE[p])
    .filter((p): p is string => p !== undefined);

  const body = {
    textQuery: params.textQuery,
    languageCode: params.lang ?? 'fr',
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
      'X-Goog-FieldMask': textSearchFieldMask(params.ambiance),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[places] Text Search a échoué', res.status, detail);
    // Même un 400 de Google (clé invalide, type inconnu…) est un problème serveur, pas client.
    throw new PlacesError(tx('La recherche Google Places a échoué'), 502);
  }

  const json = (await res.json()) as { places?: GooglePlace[] };
  const now = new Date();
  return (json.places ?? [])
    .map((p) => mapPlace(p, now, params.lang))
    .filter((p): p is RawPlace => p !== null);
}

export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

export async function placeDetails(
  id: string,
  mode: 'full' | 'summary',
  lang: Lang = 'fr',
): Promise<PlaceDetails> {
  if (!PLACE_ID_PATTERN.test(id)) throw new PlacesError(tx('Identifiant de lieu invalide'), 400);

  const url = new URL(`${PLACES_BASE}/places/${id}`);
  // Avis, horaires et libellés dans la langue de l'utilisateur.
  url.searchParams.set('languageCode', lang);
  url.searchParams.set('regionCode', 'FR');

  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': mode === 'full' ? DETAILS_FIELD_MASK : SUMMARY_FIELD_MASK,
    },
  });
  if (res.status === 404) throw new PlacesError(tx('Lieu introuvable'), 404);
  if (!res.ok) {
    console.error('[places] Place Details a échoué', res.status, await res.text());
    throw new PlacesError(tx('Impossible de charger ce lieu'), 502);
  }
  const details = mapDetails((await res.json()) as GooglePlace, new Date(), lang);
  if (!details) throw new PlacesError(tx('Lieu introuvable'), 404);
  return details;
}

// Fiche Google d'une salle (onglet « Avis » des événements) : une semaine de cache.
const venueCache = new TtlCache<string | null>(7 * 24 * 3_600_000, 500);

/**
 * place_id Google d'une salle de spectacle à partir de son nom et de sa position.
 * Recherche « IDs seulement » (champ places.id) : le niveau le moins cher de Google.
 */
export async function findVenuePlaceId(name: string, location: LatLng, address?: string): Promise<string | null> {
  const query = [name, address].filter(Boolean).join(', ').slice(0, 200);
  const key = `${query}|${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
  const hit = venueCache.get(key);
  if (hit !== undefined) return hit;
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey(), 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({
      textQuery: query,
      regionCode: 'FR',
      pageSize: 1,
      locationBias: { circle: { center: { latitude: location.lat, longitude: location.lng }, radius: 300 } },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new PlacesError(tx('La recherche Google Places a échoué'), 502);
  const id = ((await res.json()) as { places?: { id?: string }[] }).places?.[0]?.id ?? null;
  venueCache.set(key, id);
  return id;
}

// Photo principale d'une fiche Google : la référence change rarement, une journée de cache.
const mainPhotoCache = new TtlCache<string | null>(24 * 3_600_000, 500);

/** Référence de la 1re photo de la fiche Google (« places/…/photos/… »), ou null. */
export async function mainPhotoName(id: string): Promise<string | null> {
  if (!PLACE_ID_PATTERN.test(id)) return null;
  const hit = mainPhotoCache.get(id);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`${PLACES_BASE}/places/${id}`, {
      headers: { 'X-Goog-Api-Key': apiKey(), 'X-Goog-FieldMask': 'photos' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null; // pas mis en cache : nouvel essai plus tard
    const body = (await res.json()) as { photos?: { name?: string }[] };
    const name = body.photos?.[0]?.name ?? null;
    mainPhotoCache.set(id, name);
    return name;
  } catch {
    return null;
  }
}

/**
 * Renvoie l'URL temporaire (googleusercontent) d'une photo, sans exposer la clé.
 * `name` a la forme « places/{placeId}/photos/{photoId} ».
 */
export async function photoUri(name: string, maxWidthPx: number): Promise<string> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    throw new PlacesError(tx('Référence de photo invalide'), 400);
  }
  const url = new URL(`${PLACES_BASE}/${name}/media`);
  url.searchParams.set('maxWidthPx', String(maxWidthPx));
  url.searchParams.set('skipHttpRedirect', 'true');

  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey() } });
  if (!res.ok) {
    console.error('[places] Photo a échoué', res.status, await res.text());
    throw new PlacesError(tx('Photo indisponible'), res.status === 404 ? 404 : 502);
  }
  const json = (await res.json()) as { photoUri?: string };
  if (!json.photoUri) throw new PlacesError(tx('Photo indisponible'), 502);
  return json.photoUri;
}
