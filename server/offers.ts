// Bons plans : offres des établissements partenaires (« 1 verre offert avant 20 h »…),
// saisies dans l'espace partenaires ou dans server/offers.json.

import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import { type Lang, translate } from '@/shared/i18n';
import type { LatLng, Offer } from '@/shared/types';

import { translateFields } from './autoTranslate';
import { getContent } from './content';
import { hhmmToMinutes, parisParts } from './paris';
import type { OfferItem } from './schemas';

/** Statut de l'offre aujourd'hui, ou null si elle ne s'applique pas aujourd'hui. */
export function offerToday(
  offer: OfferItem,
  now: Date = new Date(),
  lang: Lang = 'fr',
): { live: boolean; schedule: string } | null {
  if (!offer.active) return null;
  const { date, day, minutes } = parisParts(now);
  if (date < offer.startDate || date > offer.endDate) return null;
  if (offer.days?.length && !offer.days.includes(day)) return null;

  if (!offer.startTime || !offer.endTime) return { live: true, schedule: translate(lang, 'Toute la journée') };
  const start = hhmmToMinutes(offer.startTime);
  const end = hhmmToMinutes(offer.endTime);
  // Créneau qui passe minuit (ex. 22:00 → 02:00).
  const live = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  const schedule = translate(lang, 'Aujourd’hui de {start} à {end}', {
    start: offer.startTime.replace(':', 'h'),
    end: offer.endTime.replace(':', 'h'),
  });
  // Créneau déjà terminé aujourd'hui : on ne l'affiche plus.
  if (!live && start <= end && minutes >= end) return null;
  return { live, schedule };
}

export function toOffer(item: OfferItem, status: { live: boolean; schedule: string }, from?: LatLng): Offer {
  const distanceMeters = from ? Math.round(haversineMeters(from, item.location)) : undefined;
  return {
    id: item.id,
    placeId: item.placeId,
    placeName: item.placeName,
    location: item.location,
    title: item.title,
    description: item.description,
    conditions: item.conditions,
    schedule: status.schedule,
    live: status.live,
    distanceMeters,
    walkMinutes: distanceMeters !== undefined ? estimateWalkMinutes(distanceMeters) : undefined,
  };
}

export function selectOffersNear(
  items: OfferItem[],
  near: LatLng,
  now: Date = new Date(),
  radiusMeters = 5000,
  lang: Lang = 'fr',
): Offer[] {
  return items
    .flatMap((item) => {
      const status = offerToday(item, now, lang);
      return status ? [toOffer(item, status, near)] : [];
    })
    .filter((o) => (o.distanceMeters ?? 0) <= radiusMeters)
    // Du plus proche au plus loin (l'étiquette « en cours » reste affichée sur la carte).
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 30);
}

// Textes saisis par les partenaires (en français) : traduits automatiquement.
const PARTNER_TEXT: (keyof Offer)[] = ['title', 'description', 'conditions'];

export async function offersNear(near: LatLng, lang: Lang = 'fr', now: Date = new Date()): Promise<Offer[]> {
  const offers = selectOffersNear(await getContent('offers'), near, now, 5000, lang);
  return translateFields(offers, PARTNER_TEXT, lang);
}

export async function offersForPlace(placeId: string, lang: Lang = 'fr', now: Date = new Date()): Promise<Offer[]> {
  const offers = (await getContent('offers'))
    .filter((item) => item.placeId === placeId)
    .flatMap((item) => {
      const status = offerToday(item, now, lang);
      return status ? [toOffer(item, status)] : [];
    });
  return translateFields(offers, PARTNER_TEXT, lang);
}
