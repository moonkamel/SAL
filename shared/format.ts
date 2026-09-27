import type { OpeningStatus, PriceLevel } from './types';

/** 350 m · 1,2 km · 12 km */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** ~12 min à pied · ~1 h 05 à pied */
export function formatWalk(minutes: number): string {
  if (minutes < 60) return `~${minutes} min à pied`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h} h ${String(m).padStart(2, '0')} à pied`;
}

/** 87 avis · 1,2 k avis */
export function formatRatingCount(count: number): string {
  if (count < 1000) return `${count} avis`;
  const k = (count / 1000).toFixed(1).replace('.', ',').replace(',0', '');
  return `${k} k avis`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}

export function formatPrice(level: PriceLevel): string {
  return level === 0 ? 'Gratuit' : '€'.repeat(level);
}

export function formatOpening(status: OpeningStatus): string {
  if (status.openNow) return status.closesAt ? `Ouvert · ferme à ${status.closesAt}` : 'Ouvert';
  if (!status.opensAt) return 'Fermé';
  // « 18:00 » (aujourd'hui) ou « mar. 12:00 » (autre jour)
  return status.opensAt.includes(' ')
    ? `Fermé · ouvre ${status.opensAt}`
    : `Fermé · ouvre à ${status.opensAt}`;
}

/** 45 s → « 1 min » · 720 s → « 12 min » · 3900 s → « 1 h 05 » */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Heure d'arrivée estimée « 20:35 » à partir de maintenant. */
export function formatArrival(seconds: number, now: Date = new Date()): string {
  const arrival = new Date(now.getTime() + seconds * 1000);
  return `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`;
}
