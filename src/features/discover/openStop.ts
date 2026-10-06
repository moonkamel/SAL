import { router } from 'expo-router';

import type { Stop } from '@/shared/discover';

/**
 * Étape d'un parcours : un lieu précis ouvre l'itinéraire ; une étape « recherche »
 * (estaminet, bar à bières) ouvre les adresses autour de soi.
 */
export function openStop(stop: Stop, t: (fr: string) => string): void {
  if (stop.location) {
    router.push({
      pathname: '/route/[id]',
      params: {
        id: `poi-${stop.id}`,
        name: t(stop.name),
        lat: String(stop.location.lat),
        lng: String(stop.location.lng),
      },
    });
  } else if (stop.query) {
    router.push({ pathname: '/results', params: { q: t(stop.query) } });
  }
}
