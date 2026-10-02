import { decimal, type Lang, translate } from './i18n';
import type { OpeningStatus, PriceLevel } from './types';

/** 350 m · 1,2 km · 12 km */
export function formatDistance(meters: number, lang: Lang = 'fr'): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? decimal(lang, km.toFixed(1)) : Math.round(km)} km`;
}

/** ~12 min à pied · ~1 h 05 à pied */
export function formatWalk(minutes: number, lang: Lang = 'fr'): string {
  if (minutes < 60) return translate(lang, '~{n} min à pied', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return translate(lang, '~{h} h {m} à pied', { h, m: String(m).padStart(2, '0') });
}

/** 87 avis · 1,2 k avis */
export function formatRatingCount(count: number, lang: Lang = 'fr'): string {
  if (count < 1000) return translate(lang, '{n} avis', { n: count });
  const k = decimal(lang, (count / 1000).toFixed(1)).replace(/[.,]0$/, '');
  return translate(lang, '{n} k avis', { n: k });
}

export function formatRating(rating: number, lang: Lang = 'fr'): string {
  return decimal(lang, rating.toFixed(1));
}

export function formatPrice(level: PriceLevel, lang: Lang = 'fr'): string {
  return level === 0 ? translate(lang, 'Gratuit') : '€'.repeat(level);
}

export function formatOpening(status: OpeningStatus, lang: Lang = 'fr'): string {
  if (status.openNow) {
    return status.closesAt
      ? translate(lang, 'Ouvert · ferme à {time}', { time: status.closesAt })
      : translate(lang, 'Ouvert');
  }
  if (!status.opensAt) return translate(lang, 'Fermé');
  // « 18:00 » (aujourd'hui) ou « mar. 12:00 » (autre jour)
  return status.opensAt.includes(' ')
    ? translate(lang, 'Fermé · ouvre {time}', { time: status.opensAt })
    : translate(lang, 'Fermé · ouvre à {time}', { time: status.opensAt });
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
