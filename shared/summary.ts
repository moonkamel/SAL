import { estimateWalkMinutes, haversineMeters } from './geo';
import type { LatLng, PlaceDetails, PlaceSummary } from './types';

/** Transforme une fiche (Place Details) en carte de résultat, vue depuis `from`. */
export function detailsToSummary(p: PlaceDetails, from: LatLng, sponsored = false): PlaceSummary {
  const distanceMeters = Math.round(haversineMeters(from, p.location));
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    location: p.location,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    opening: p.opening,
    photo: p.photos[0],
    distanceMeters,
    walkMinutes: estimateWalkMinutes(distanceMeters),
    sponsored,
    score: 0,
  };
}
