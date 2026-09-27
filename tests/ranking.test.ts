import { describe, expect, it } from 'vitest';

import { bayesianRating, RANKING, scorePlace } from '@/server/ranking';

const base = { distanceMeters: 500, relevanceIndex: 0, resultCount: 10 };

describe('bayesianRating', () => {
  it('tire une note sur peu d’avis vers la note a priori', () => {
    expect(bayesianRating(5, 2)).toBeLessThan(4);
    expect(bayesianRating(5, 2)).toBeGreaterThan(RANKING.priorRating);
  });

  it('fait confiance à une note appuyée par beaucoup d’avis', () => {
    expect(bayesianRating(4.6, 3000)).toBeCloseTo(4.59, 1);
  });

  it('utilise la note a priori sans avis', () => {
    expect(bayesianRating(undefined, undefined)).toBe(RANKING.priorRating);
  });
});

describe('scorePlace', () => {
  it('reste entre 0 et 1', () => {
    const s = scorePlace({ ...base, rating: 5, userRatingCount: 100000, distanceMeters: 0 });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('préfère un 4,6 avec 1 200 avis à un 5,0 avec 3 avis', () => {
    const solid = scorePlace({ ...base, rating: 4.6, userRatingCount: 1200 });
    const fragile = scorePlace({ ...base, rating: 5, userRatingCount: 3 });
    expect(solid).toBeGreaterThan(fragile);
  });

  it('préfère le lieu le plus proche à qualité égale', () => {
    const near = scorePlace({ ...base, rating: 4.3, userRatingCount: 400, distanceMeters: 300 });
    const far = scorePlace({ ...base, rating: 4.3, userRatingCount: 400, distanceMeters: 3000 });
    expect(near).toBeGreaterThan(far);
  });

  it('tient compte de l’ordre de pertinence Google', () => {
    const first = scorePlace({ ...base, rating: 4.3, userRatingCount: 400, relevanceIndex: 0 });
    const last = scorePlace({ ...base, rating: 4.3, userRatingCount: 400, relevanceIndex: 9 });
    expect(first).toBeGreaterThan(last);
  });

  it('accepte des poids personnalisés', () => {
    const distanceOnly = { rating: 0, popularity: 0, distance: 1, relevance: 0 };
    expect(scorePlace({ ...base, distanceMeters: 0 }, distanceOnly)).toBe(1);
  });
});
