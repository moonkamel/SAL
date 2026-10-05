import { describe, expect, it } from 'vitest';

import { sortPlaces } from '@/shared/sortPlaces';
import type { PlaceSummary } from '@/shared/types';

const place = (id: string, over: Partial<PlaceSummary>): PlaceSummary =>
  ({ id, name: id, distanceMeters: 500, sponsored: false, ...over }) as PlaceSummary;

const list = [
  place('pres-moyen', { distanceMeters: 100, rating: 4.0, userRatingCount: 300 }),
  place('loin-excellent', { distanceMeters: 2500, rating: 4.8, userRatingCount: 900 }),
  place('peu-avis', { distanceMeters: 600, rating: 5.0, userRatingCount: 4 }),
  place('sponso', { distanceMeters: 1800, rating: 4.2, userRatingCount: 50, sponsored: true }),
];

describe('tri des résultats', () => {
  it('« Recommandés » garde l’ordre du serveur', () => {
    expect(sortPlaces(list, 'recommended')).toBe(list);
  });

  it('« Plus proches » : sponsorisé en tête, puis par distance', () => {
    expect(sortPlaces(list, 'nearest').map((p) => p.id)).toEqual(['sponso', 'pres-moyen', 'peu-avis', 'loin-excellent']);
  });

  it('« Mieux notés » : les notes avec trop peu d’avis passent après', () => {
    expect(sortPlaces(list, 'topRated').map((p) => p.id)).toEqual(['sponso', 'loin-excellent', 'pres-moyen', 'peu-avis']);
  });
});
