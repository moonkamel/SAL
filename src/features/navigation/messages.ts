// Messages en français pour les statuts du Navigation SDK. Les valeurs sont celles
// des énumérations NavigationSessionStatus et RouteStatus du SDK (chaînes).

import type { TravelMode } from '@/shared/types';

const SESSION_MESSAGES: Record<string, string> = {
  notAuthorized:
    'La clé Google de l’application n’est pas autorisée pour le guidage (Navigation SDK). Vérifiez sa configuration.',
  termsNotAccepted: 'Les conditions d’utilisation du guidage doivent être acceptées.',
  networkError: 'Pas de connexion internet. Vérifiez votre réseau et réessayez.',
  locationPermissionMissing: 'La localisation est nécessaire pour vous guider.',
};

const ROUTE_MESSAGES: Record<string, string> = {
  NO_ROUTE_FOUND: 'Aucun itinéraire trouvé vers ce lieu avec ce mode de transport.',
  NETWORK_ERROR: 'Pas de connexion internet. Vérifiez votre réseau et réessayez.',
  QUOTA_CHECK_FAILED: 'Le service de guidage est momentanément indisponible.',
  LOCATION_DISABLED: 'Votre position n’est pas disponible. Activez la localisation et réessayez.',
  LOCATION_UNKNOWN: 'Votre position n’a pas pu être déterminée. Réessayez à l’extérieur.',
  WAYPOINT_ERROR: 'La destination n’a pas pu être reconnue.',
  INVALID_PLACE_ID: 'La destination n’a pas pu être reconnue.',
  DUPLICATE_WAYPOINTS_ERROR: 'La destination n’a pas pu être reconnue.',
  ROUTE_CANCELED: 'Le calcul de l’itinéraire a été interrompu. Réessayez.',
};

export function sessionErrorMessage(status: string): string {
  return SESSION_MESSAGES[status] ?? 'Le guidage n’a pas pu démarrer. Réessayez.';
}

export function routeErrorMessage(status: string): string {
  return ROUTE_MESSAGES[status] ?? 'L’itinéraire n’a pas pu être calculé. Réessayez.';
}

/** Modes pris en charge par le guidage (pas de transports en commun dans le SDK). */
export function isGuidable(mode: TravelMode): boolean {
  return mode !== 'transit';
}
