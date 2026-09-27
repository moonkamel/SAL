import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  AgendaResponse,
  AgendaWhen,
  ApiError,
  LatLng,
  OffersResponse,
  PlaceDetails,
  RouteResponse,
  SearchRequest,
  SearchResponse,
  SurpriseResponse,
  TransitResponse,
  VlilleResponse,
  WeatherResponse,
} from '@/shared/types';

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
  let res: Response;
  try {
    res = await fetch(`${apiOrigin()}${path}`, init);
  } catch {
    throw new ApiRequestError('Connexion impossible. Vérifiez votre réseau.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(body?.error ?? 'Une erreur est survenue. Réessayez.');
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
  const hit = cachedPlace(`full|${id}`) ?? (mode === 'summary' ? cachedPlace(`summary|${id}`) : undefined);
  if (hit) return hit;
  const query = mode === 'summary' ? '?fields=summary' : '';
  const value = await request<PlaceDetails>(`/api/place/${encodeURIComponent(id)}${query}`, {
    signal,
  });
  if (placeCache.size > 200) placeCache.clear();
  placeCache.set(`${mode}|${id}`, { value, expiresAt: Date.now() + PLACE_TTL_MS });
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

export function getTransit(near: LatLng, signal?: AbortSignal): Promise<TransitResponse> {
  return request<TransitResponse>(`/api/transit?near=${near.lat},${near.lng}`, { signal });
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

export function getOffers(near: LatLng, signal?: AbortSignal): Promise<OffersResponse> {
  return request<OffersResponse>(`/api/offers?near=${near.lat},${near.lng}`, { signal });
}

export function getAgenda(
  near: LatLng,
  when: AgendaWhen,
  signal?: AbortSignal,
): Promise<AgendaResponse> {
  return request<AgendaResponse>(`/api/agenda?near=${near.lat},${near.lng}&when=${when}`, {
    signal,
  });
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

export function photoUrl(photoName: string, width = 400): string {
  return `${apiOrigin()}/api/photo?name=${encodeURIComponent(photoName)}&w=${width}`;
}
