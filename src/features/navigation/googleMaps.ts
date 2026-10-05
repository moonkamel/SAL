import type { LatLng, TravelMode } from '@/shared/types';

const TRAVEL: Record<TravelMode, string> = {
  walk: 'walking',
  bicycle: 'bicycling',
  drive: 'driving',
  transit: 'transit',
};

/** Identifiant de lieu Google (Places API), reconnu par Google Maps. */
const GOOGLE_PLACE_ID = /^ChIJ[\w-]+$/;

/**
 * Itinéraire dans Google Maps (appli si installée, sinon site), guidage vocal compris.
 * Transports : Google Maps affiche les trajets et horaires, sans lancer de guidage.
 */
export function googleMapsDirections(
  to: LatLng,
  mode: TravelMode,
  place?: { id?: string; name?: string },
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${to.lat},${to.lng}`,
    travelmode: TRAVEL[mode],
  });
  if (place?.id && GOOGLE_PLACE_ID.test(place.id)) {
    // Avec l'identifiant, Google Maps affiche le nom du lieu plutôt que des coordonnées.
    params.set('destination', place.name ?? `${to.lat},${to.lng}`);
    params.set('destination_place_id', place.id);
  }
  if (mode !== 'transit') params.set('dir_action', 'navigate');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Parcours à plusieurs étapes dans Google Maps, depuis la position actuelle :
 * la dernière étape est la destination, les autres des étapes intermédiaires
 * (8 au plus, au-delà Google Maps les ignore).
 */
export function googleMapsTour(points: LatLng[], mode: TravelMode = 'walk'): string {
  const steps = points.slice(0, 9);
  const last = steps[steps.length - 1]!;
  const params = new URLSearchParams({
    api: '1',
    destination: `${last.lat},${last.lng}`,
    travelmode: TRAVEL[mode],
  });
  const waypoints = steps.slice(0, -1).map((p) => `${p.lat},${p.lng}`);
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
