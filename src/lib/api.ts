import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  AgendaEvent,
  AgendaResponse,
  AgendaWhen,
  ApiError,
  ItinerariesResponse,
  LatLng,
  OffersResponse,
  PlaceDetails,
  RouteResponse,
  SearchRequest,
  SearchResponse,
  SurpriseResponse,
  StopDeparturesResponse,
  VlilleResponse,
  WeatherResponse,
} from '@/shared/types';
import { translate } from '@/shared/i18n';

import { currentLang } from '@/src/i18n';

/**
 * Origine du backend :
 * - EXPO_PUBLIC_API_URL si défini (production, EAS Hosting) ;
 * - sinon le serveur de développement Metro, qui sert aussi les routes API.
 */
function apiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  // Sur le web, l'app et les routes API sont servies par la même origine.
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri}`;
  throw new Error('Backend introuvable : définissez EXPO_PUBLIC_API_URL');
}

export class ApiRequestError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const lang = currentLang();
  let res: Response;
  try {
    // Le serveur répond dans la langue choisie (Google, agenda, textes).
    res = await fetch(`${apiOrigin()}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), 'Accept-Language': lang },
    });
  } catch {
    throw new ApiRequestError(translate(lang, 'Connexion impossible. Vérifiez votre réseau.'));
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    // Messages d'erreur du serveur rédigés en français : traduits ici.
    throw new ApiRequestError(translate(lang, body?.error ?? 'Une erreur est survenue. Réessayez.'));
  }
  return (await res.json()) as T;
}

export function searchPlaces(body: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
  return request<SearchResponse>('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

// Fiches déjà chargées pendant la session (quelques minutes, en mémoire seulement) :
// revenir sur un lieu ou rouvrir les favoris ne redéclenche pas d'appel Google.
const PLACE_TTL_MS = 5 * 60_000;
const placeCache = new Map<string, { value: PlaceDetails; expiresAt: number }>();

function cachedPlace(key: string): PlaceDetails | undefined {
  const hit = placeCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    placeCache.delete(key);
    return undefined;
  }
  return hit.value;
}

export async function getPlace(
  id: string,
  mode: 'full' | 'summary' = 'full',
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  // Une fiche complète sert aussi de résumé.
  const lang = currentLang();
  const hit =
    cachedPlace(`full|${lang}|${id}`) ??
    (mode === 'summary' ? cachedPlace(`summary|${lang}|${id}`) : undefined);
  if (hit) return hit;
  const query = mode === 'summary' ? '?fields=summary' : '';
  const value = await request<PlaceDetails>(`/api/place/${encodeURIComponent(id)}${query}`, {
    signal,
  });
  if (placeCache.size > 200) placeCache.clear();
  placeCache.set(`${mode}|${lang}|${id}`, { value, expiresAt: Date.now() + PLACE_TTL_MS });
  return value;
}

export function getRoutes(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteResponse> {
  const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`;
  return request<RouteResponse>(`/api/route?${q}`, { signal });
}

export function getVlille(near: LatLng, limit = 3, signal?: AbortSignal): Promise<VlilleResponse> {
  return request<VlilleResponse>(`/api/vlille?near=${near.lat},${near.lng}&limit=${limit}`, {
    signal,
  });
}

/** Prochains passages Ilévia en temps réel à un arrêt, par son nom. */
export function getStopDepartures(stop: string, signal?: AbortSignal): Promise<StopDeparturesResponse> {
  return request<StopDeparturesResponse>(`/api/transit?stop=${encodeURIComponent(stop)}`, { signal });
}

export function getWeather(near: LatLng, signal?: AbortSignal): Promise<WeatherResponse> {
  return request<WeatherResponse>(`/api/weather?near=${near.lat},${near.lng}`, { signal });
}

export function getSurprise(near: LatLng, signal?: AbortSignal): Promise<SurpriseResponse> {
  return request<SurpriseResponse>(`/api/surprise?near=${near.lat},${near.lng}`, { signal });
}

/** Lien public vers la fiche d'un lieu (web), si le backend est déployé. */
export function placeWebUrl(id: string): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  return configured ? `${configured.replace(/\/$/, '')}/place/${encodeURIComponent(id)}` : undefined;
}

export function getItineraries(
  from: LatLng,
  to: LatLng,
  name: string,
  signal?: AbortSignal,
): Promise<ItinerariesResponse> {
  const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&name=${encodeURIComponent(name)}`;
  return request<ItinerariesResponse>(`/api/itineraries?${q}`, { signal });
}

export function getOffers(near: LatLng, signal?: AbortSignal): Promise<OffersResponse> {
  return request<OffersResponse>(`/api/offers?near=${near.lat},${near.lng}`, { signal });
}

// Derniers événements reçus : la fiche d'un événement s'ouvre sans nouvel appel.
const knownEvents = new Map<string, AgendaEvent>();

export async function getAgenda(
  near: LatLng,
  when: AgendaWhen,
  signal?: AbortSignal,
): Promise<AgendaResponse> {
  const res = await request<AgendaResponse>(`/api/agenda?near=${near.lat},${near.lng}&when=${when}`, {
    signal,
  });
  if (knownEvents.size > 500) knownEvents.clear();
  for (const e of res.events) knownEvents.set(e.id, e);
  return res;
}

export function getKnownEvent(id: string): AgendaEvent | undefined {
  return knownEvents.get(id);
}

// --- Espace partenaires ---

export function adminRequest<T>(
  password: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  return request<T>(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${password}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** URL complète d'un lien partenaire (passe par /api/go, qui compte le clic). */
export function partnerLinkUrl(path: string): string {
  return `${apiOrigin()}${path}`;
}

// Salle d'un événement → sa fiche Google (pour les avis). Gardé pendant la session.
const venueIds = new Map<string, string | null>();

export async function findVenue(
  event: Pick<AgendaEvent, 'venueName' | 'location' | 'address'>,
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `${event.venueName}|${event.location.lat},${event.location.lng}`;
  if (venueIds.has(key)) return venueIds.get(key)!;
  const q = new URLSearchParams({ name: event.venueName, near: `${event.location.lat},${event.location.lng}` });
  if (event.address) q.set('address', event.address);
  const res = await request<{ placeId: string | null }>(`/api/venue?${q}`, { signal });
  venueIds.set(key, res.placeId);
  return res.placeId;
}

export function photoUrl(photoName: string, width = 400): string {
  return `${apiOrigin()}/api/photo?name=${encodeURIComponent(photoName)}&w=${width}`;
}
