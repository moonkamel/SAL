import type { LatLng } from './types';

/** Grand-Place de Lille : position par défaut si la localisation est refusée. */
export const GRAND_PLACE: LatLng = { lat: 50.6366, lng: 3.0635 };

/** Rayon de recherche historique (la recherche est désormais limitée à Lille : shared/lille.ts). */
export const SEARCH_RADIUS_METERS = 5000;

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// En centre-ville, un trajet à pied fait environ 1,3 fois la distance à vol d'oiseau.
const DETOUR_FACTOR = 1.3;
const WALK_METERS_PER_MINUTE = 80; // ≈ 4,8 km/h

/** Estimation du temps de marche, sans appel à une API d'itinéraire. */
export function estimateWalkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round((distanceMeters * DETOUR_FACTOR) / WALK_METERS_PER_MINUTE));
}
