import { tx } from './i18n';

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
  /** Ambiances demandées (toutes doivent être présentes). */
  ambiance?: Ambiance[];
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
  /** Ambiances confirmées par Google (seulement si des filtres d'ambiance sont actifs). */
  ambiance?: Ambiance[];
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
  /** Ambiances confirmées par Google (fiche complète). */
  ambiance?: Ambiance[];
  /** Types Google (restaurant, bar, night_club…), fiche complète. */
  types?: string[];
  /** Liens partenaires (réservation, billetterie, VTC), ajoutés par /api/place. */
  partnerLinks?: PartnerLink[];
  /** Bons plans du jour chez ce lieu, ajoutés par /api/place. */
  offers?: Offer[];
}

export type PartnerKind = 'booking' | 'tickets' | 'ride' | 'delivery';

/** Lien d'affiliation, toujours signalé comme « lien partenaire » dans l'app. */
export interface PartnerLink {
  id: string;
  kind: PartnerKind;
  /** Libellé du bouton, ex. « Réserver une table ». */
  label: string;
  /** Nom du partenaire affiché sous le bouton. */
  partner: string;
  /** Chemin relatif vers /api/go (compte le clic puis redirige). */
  path: string;
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

// --- Filtres d'ambiance (Google Places : champs « Atmosphere ») ---

export type Ambiance =
  | 'terrace'
  | 'liveMusic'
  | 'groups'
  | 'kids'
  | 'cocktails'
  | 'vegetarian'
  | 'accessible';

export const AMBIANCE_LABELS: Record<Ambiance, string> = {
  terrace: tx('Terrasse'),
  liveMusic: tx('Musique live'),
  groups: tx('En groupe'),
  kids: tx('Avec enfants'),
  cocktails: tx('Cocktails'),
  vegetarian: tx('Végétarien'),
  accessible: tx('Accès fauteuil'),
};

// --- V'Lille (vélos en libre-service, temps réel GBFS) ---

export interface VlilleStation {
  id: string;
  name: string;
  location: LatLng;
  bikes: number;
  docks: number;
  /** Faux si la station est hors service (pas de location ou de dépôt possible). */
  operational: boolean;
  distanceMeters: number;
  walkMinutes: number;
}

export interface VlilleResponse {
  stations: VlilleStation[];
  /** Horodatage des données (ISO), pour afficher « il y a 1 min ». */
  updatedAt?: string;
}

// --- Ilévia (prochains passages métro, tram, bus) ---

export interface TransitDeparture {
  line: string;
  direction: string;
  /** Minutes avant les prochains départs (triées). */
  minutes: number[];
}

/** Prochains passages en temps réel à un arrêt (par son nom). */
export interface StopDeparturesResponse {
  stop: string;
  departures: TransitDeparture[];
}

// --- Météo (Open-Meteo) et suggestions ---

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Weather {
  temperature: number;
  condition: WeatherCondition;
  isDay: boolean;
}

/** Idée de sortie adaptée au temps qu'il fait, à lancer comme une recherche. */
export interface Suggestion {
  title: string;
  subtitle: string;
  query: string;
  ambiance?: Ambiance[];
}

export interface WeatherResponse {
  weather: Weather;
  suggestion: Suggestion;
}

export interface SurpriseResponse {
  place: PlaceSummary;
  /** Pourquoi ce lieu, ex. « Ouvert · 4,6 ★ · 6 min à pied ». */
  reason: string;
}

// --- Bons plans (offres des établissements partenaires) ---

export interface Offer {
  id: string;
  placeId: string;
  placeName: string;
  location: LatLng;
  title: string;
  description?: string;
  conditions?: string;
  /** « Aujourd'hui de 18:00 à 20:00 », « Toute la journée »… */
  schedule: string;
  /** Vrai si l'offre est valable en ce moment. */
  live: boolean;
  distanceMeters?: number;
  walkMinutes?: number;
}

export interface OffersResponse {
  offers: Offer[];
}

// --- Agenda « Ce soir à Lille » ---

export type EventCategory = 'concert' | 'soiree' | 'expo' | 'spectacle' | 'marche' | 'sport' | 'autre';

export interface AgendaEvent {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  venueName: string;
  placeId?: string;
  location: LatLng;
  address?: string;
  /** ISO 8601. */
  start: string;
  end?: string;
  /** Horaire lisible (heure de Lille), ex. « 21:00 – 23:30 » ou « sam. 21:00 ». */
  timeLabel: string;
  price?: string;
  url?: string;
  imageUrl?: string;
  /** Événement mis en avant (sponsorisé). */
  featured: boolean;
  source: 'partner' | 'openagenda';
  distanceMeters: number;
  /** Déjà commencé à l'heure de la demande. */
  ongoing: boolean;
  /** Date complète, ex. « samedi 3 octobre · 21:00 – 23:30 ». */
  dateLabel: string;
  /** Styles de musique détectés (concerts, soirées). */
  genres?: MusicGenre[];
  /** Entrée gratuite ou libre. */
  free?: boolean;
  /** Description complète, en texte simple. */
  longDescription?: string;
  /** Billetterie ou inscription. */
  ticketUrl?: string;
}

export type MusicGenre =
  | 'jazz'
  | 'rock'
  | 'electro'
  | 'rap'
  | 'classique'
  | 'chanson'
  | 'monde'
  | 'folk';

export const GENRE_LABELS: Record<MusicGenre, string> = {
  jazz: tx('Jazz & blues'),
  rock: tx('Rock & métal'),
  electro: tx('Électro'),
  rap: tx('Rap & hip-hop'),
  classique: tx('Classique'),
  chanson: tx('Chanson & pop'),
  monde: tx('Musiques du monde'),
  folk: tx('Folk & acoustique'),
};

export type AgendaWhen = 'today' | 'tomorrow' | 'weekend';

export interface AgendaResponse {
  events: AgendaEvent[];
}

// --- Trajets détaillés en transports en commun (style Citymapper) ---

export interface TransitLineInfo {
  /** « M1 », « R », « L1 »… */
  short: string;
  name: string;
  /** Couleurs officielles de la ligne (#RRGGBB). */
  color: string;
  textColor: string;
  /** « Métro », « Tram », « Bus »… */
  vehicle: string;
}

export interface TransitStopInfo {
  name: string;
  location: LatLng;
}

export type TripSegment =
  | {
      kind: 'walk';
      durationSeconds: number;
      distanceMeters: number;
      /** Tracé encodé. */
      polyline: string;
      from: LatLng;
      to: LatLng;
      /** Nom de l'arrêt ou du lieu d'arrivée de ce tronçon à pied. */
      toName: string;
    }
  | {
      kind: 'ride';
      line: TransitLineInfo;
      /** Direction affichée sur le véhicule. */
      headsign: string;
      departureStop: TransitStopInfo;
      arrivalStop: TransitStopInfo;
      /** ISO 8601. */
      departureTime: string;
      arrivalTime: string;
      stopCount: number;
      durationSeconds: number;
      polyline: string;
    };

export interface TransitItinerary {
  id: string;
  /** ISO 8601 : départ (à pied) et arrivée à destination. */
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  walkMeters: number;
  /** Tarif indiqué par Google, ex. « 1,80 € ». */
  fare?: string;
  segments: TripSegment[];
  /** Même trajet, départs suivants du 1er véhicule (ISO), ex. métro toutes les 2 min. */
  nextDepartures?: string[];
}

export interface ItinerariesResponse {
  itineraries: TransitItinerary[];
}
