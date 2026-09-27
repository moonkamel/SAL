import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  ApiError,
  LatLng,
  PlaceDetails,
  RouteResponse,
  SearchRequest,
  SearchResponse,
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

export function getPlace(
  id: string,
  mode: 'full' | 'summary' = 'full',
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const query = mode === 'summary' ? '?fields=summary' : '';
  return request<PlaceDetails>(`/api/place/${encodeURIComponent(id)}${query}`, { signal });
}

export function getRoutes(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteResponse> {
  const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`;
  return request<RouteResponse>(`/api/route?${q}`, { signal });
}

export function photoUrl(photoName: string, width = 400): string {
  return `${apiOrigin()}/api/photo?name=${encodeURIComponent(photoName)}&w=${width}`;
}
