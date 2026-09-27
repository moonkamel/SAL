// Types partagés entre l'application et le backend.

export interface LatLng {
  lat: number;
  lng: number;
}

/** 0 = gratuit … 4 = très cher (échelle Google Places). */
export type PriceLevel = 0 | 1 | 2 | 3 | 4;

export interface SearchFilters {
  openNow?: boolean;
  /** Distance maximale en mètres. */
  maxDistanceMeters?: number;
  /** Niveaux de prix acceptés. Vide ou absent = tous. */
  priceLevels?: PriceLevel[];
  /** Note Google minimale (0–5). */
  minRating?: number;
}

export interface SearchRequest {
  query: string;
  location: LatLng;
  filters?: SearchFilters;
}

export interface OpeningStatus {
  openNow: boolean;
  /** Heure de fermeture locale « HH:mm » si ouvert. */
  closesAt?: string;
  /** Prochaine ouverture, ex. « 18:00 » ou « mar. 12:00 », si fermé. */
  opensAt?: string;
}

export interface PhotoRef {
  /** Nom de ressource Google (places/…/photos/…), à passer à /api/photo. */
  name: string;
  /** Auteurs à créditer à côté de la photo. */
  attributions: { displayName: string; uri?: string }[];
}

export interface PlaceSummary {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  opening?: OpeningStatus;
  photo?: PhotoRef;
  distanceMeters: number;
  /** Estimation du temps de marche (en minutes), pas un calcul d'itinéraire. */
  walkMinutes: number;
  sponsored: boolean;
  score: number;
}

export interface SearchResponse {
  places: PlaceSummary[];
  /** Requête réellement envoyée à Google (après reformulation éventuelle). */
  effectiveQuery: string;
  rewritten: boolean;
}

export interface ApiError {
  error: string;
}
