import type { LatLng } from '@/shared/types';

/** « 50.63,3.06 » → { lat, lng } ; null si invalide. */
export function parseLatLng(value: string | null): LatLng | null {
  const parts = value?.split(',').map(Number);
  if (!parts || parts.length !== 2) return null;
  const [lat, lng] = parts as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Uniquement la métropole lilloise (et un peu au-delà) : évite les appels inutiles. */
export function isNearLille(p: LatLng): boolean {
  return p.lat > 50.4 && p.lat < 50.9 && p.lng > 2.7 && p.lng < 3.5;
}
