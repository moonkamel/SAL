// « Surprends-moi » : un lieu ouvert, bien noté et proche, adapté à l'heure et à la météo.

import { formatRating, formatWalk } from '@/shared/format';
import { type Lang, translate } from '@/shared/i18n';
import { parisHour, pickAmongTop, surpriseQueries } from '@/shared/suggest';
import type { LatLng, PlaceSummary, SurpriseResponse, Weather } from '@/shared/types';

import { search } from './search';
import { currentWeather } from './weather';

const MIN_RATING = 4.2;
const MIN_REVIEWS = 30;

/** Lieux éligibles : non sponsorisés, ouverts, bien notés par assez de monde. */
export function surpriseCandidates(places: PlaceSummary[]): PlaceSummary[] {
  return places.filter(
    (p) =>
      !p.sponsored &&
      p.opening?.openNow === true &&
      (p.rating ?? 0) >= MIN_RATING &&
      (p.userRatingCount ?? 0) >= MIN_REVIEWS,
  );
}

export function surpriseReason(place: PlaceSummary, lang: Lang = 'fr'): string {
  const parts = [translate(lang, 'Ouvert')];
  if (place.rating !== undefined) parts.push(`${formatRating(place.rating, lang)} ★`);
  parts.push(formatWalk(place.walkMinutes, lang));
  return parts.join(' · ');
}

export async function surprise(
  location: LatLng,
  opts: { date?: Date; random?: () => number; lang?: Lang } = {},
): Promise<SurpriseResponse | null> {
  const random = opts.random ?? Math.random;
  const weather: Weather | undefined = await currentWeather(location).catch(() => undefined);
  const { queries, ambiance } = surpriseQueries(parisHour(opts.date), weather);

  // Requêtes mélangées ; on élargit progressivement le rayon, puis on lâche l'ambiance.
  const shuffled = [...queries].sort(() => random() - 0.5);
  const attempts = [
    { maxDistanceMeters: 1500, ambiance },
    { maxDistanceMeters: 3000, ambiance: undefined },
  ];
  for (const attempt of attempts) {
    for (const query of shuffled.slice(0, 2)) {
      const { places } = await search({
        query,
        location,
        filters: {
          openNow: true,
          minRating: 4,
          maxDistanceMeters: attempt.maxDistanceMeters,
          ambiance: attempt.ambiance,
        },
      }, opts.lang);
      const place = pickAmongTop(surpriseCandidates(places), 5, random);
      if (place) return { place, reason: surpriseReason(place, opts.lang) };
    }
  }
  return null;
}
