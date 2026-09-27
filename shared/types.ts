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

export interface Review {
  authorName: string;
  /** Profil Google Maps de l'auteur (à lier depuis son nom). */
  authorUri?: string;
  authorPhotoUri?: string;
  rating: number;
  /** « il y a 2 semaines », fourni par Google. */
  relativeTime: string;
  publishTime?: string;
  text: string;
}

/** Fiche lieu complète (Place Details), jamais stockée durablement. */
export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  opening?: OpeningStatus;
  /** Horaires de la semaine, ex. « lundi: 12:00 – 14:00, 19:00 – 22:30 ». */
  weekdayHours?: string[];
  photos: PhotoRef[];
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  /** Les 3 avis les plus récents (vide en mode résumé). */
  reviews: Review[];
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

/** Modes proposés. Le guidage (étape 4) ne couvre pas les transports en commun. */
export type TravelMode = 'walk' | 'bicycle' | 'drive' | 'transit';

export interface RouteOption {
  mode: TravelMode;
  /** Faux si Google ne propose pas d'itinéraire pour ce mode (ex. pas de transport). */
  available: boolean;
  durationSeconds?: number;
  distanceMeters?: number;
  /** Tracé encodé (Encoded Polyline Algorithm), à décoder avec shared/polyline. */
  polyline?: string;
  /** Transports : lignes empruntées, ex. « Métro 1 », « Tram R ». */
  transitLines?: string[];
}

export interface RouteResponse {
  options: RouteOption[];
}
