import type { LatLng, TravelMode } from '@/shared/types';

/** Secours : l'itinéraire dans l'app Google Maps (guidage vocal compris). */
export function googleMapsDirections(to: LatLng, mode: Exclude<TravelMode, 'transit'>): string {
  const travel = { walk: 'walking', bicycle: 'bicycling', drive: 'driving' }[mode];
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${travel}&dir_action=navigate`;
}
