import type { PlaceSummary } from './types';

export type PlaceSort = 'recommended' | 'nearest' | 'topRated';

/** En dessous, une note n'est pas assez fiable pour « Mieux notés ». */
export const MIN_REVIEWS_FOR_TOP = 20;

/**
 * Tri choisi sur l'écran des résultats. Les lieux sponsorisés restent en tête
 * (badge visible) ; « Recommandés » garde l'ordre du serveur (note, distance…).
 */
export function sortPlaces(places: PlaceSummary[], sort: PlaceSort): PlaceSummary[] {
  if (sort === 'recommended') return places;
  const sponsored = places.filter((p) => p.sponsored);
  const organic = places.filter((p) => !p.sponsored);
  if (sort === 'nearest') {
    return [...sponsored, ...organic.sort((a, b) => a.distanceMeters - b.distanceMeters)];
  }
  // Mieux notés : les notes fiables d'abord (≥ 20 avis), les autres ensuite.
  const reliable = (p: PlaceSummary) => (p.userRatingCount ?? 0) >= MIN_REVIEWS_FOR_TOP && p.rating !== undefined;
  const byRating = (a: PlaceSummary, b: PlaceSummary) =>
    (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0);
  return [
    ...sponsored,
    ...organic.filter(reliable).sort(byRating),
    ...organic.filter((p) => !reliable(p)).sort(byRating),
  ];
}
