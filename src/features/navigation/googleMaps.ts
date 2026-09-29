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
