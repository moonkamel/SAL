// Bons plans : offres des établissements partenaires (« 1 verre offert avant 20 h »…),
// saisies dans l'espace partenaires ou dans server/offers.json.

import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { LatLng, Offer } from '@/shared/types';

import { getContent } from './content';
import { hhmmToMinutes, parisParts } from './paris';
import type { OfferItem } from './schemas';

/** Statut de l'offre aujourd'hui, ou null si elle ne s'applique pas aujourd'hui. */
export function offerToday(
  offer: OfferItem,
  now: Date = new Date(),
): { live: boolean; schedule: string } | null {
  if (!offer.active) return null;
  const { date, day, minutes } = parisParts(now);
  if (date < offer.startDate || date > offer.endDate) return null;
  if (offer.days?.length && !offer.days.includes(day)) return null;

  if (!offer.startTime || !offer.endTime) return { live: true, schedule: 'Toute la journée' };
  const start = hhmmToMinutes(offer.startTime);
  const end = hhmmToMinutes(offer.endTime);
  // Créneau qui passe minuit (ex. 22:00 → 02:00).
  const live = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  const schedule = `Aujourd’hui de ${offer.startTime.replace(':', 'h')} à ${offer.endTime.replace(':', 'h')}`;
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
): Offer[] {
  return items
    .flatMap((item) => {
      const status = offerToday(item, now);
      return status ? [toOffer(item, status, near)] : [];
    })
    .filter((o) => (o.distanceMeters ?? 0) <= radiusMeters)
    .sort((a, b) => Number(b.live) - Number(a.live) || (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, 30);
}

export async function offersNear(near: LatLng, now: Date = new Date()): Promise<Offer[]> {
  return selectOffersNear(await getContent('offers'), near, now);
}

export async function offersForPlace(placeId: string, now: Date = new Date()): Promise<Offer[]> {
  return (await getContent('offers'))
    .filter((item) => item.placeId === placeId)
    .flatMap((item) => {
      const status = offerToday(item, now);
      return status ? [toOffer(item, status)] : [];
    });
}
