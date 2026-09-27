import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatOpening,
  formatPrice,
  formatRating,
  formatRatingCount,
  formatWalk,
} from '@/shared/format';
import { estimateWalkMinutes, GRAND_PLACE, haversineMeters } from '@/shared/geo';

describe('format', () => {
  it('distance', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(12_400)).toBe('12 km');
  });

  it('marche', () => {
    expect(formatWalk(12)).toBe('~12 min à pied');
    expect(formatWalk(65)).toBe('~1 h 05 à pied');
  });

  it('avis et note', () => {
    expect(formatRatingCount(87)).toBe('87 avis');
    expect(formatRatingCount(1234)).toBe('1,2 k avis');
    expect(formatRatingCount(2000)).toBe('2 k avis');
    expect(formatRating(4.55)).toBe('4,5');
  });

  it('prix', () => {
    expect(formatPrice(0)).toBe('Gratuit');
    expect(formatPrice(3)).toBe('€€€');
  });

  it('horaires', () => {
    expect(formatOpening({ openNow: true, closesAt: '23:00' })).toBe('Ouvert · ferme à 23:00');
    expect(formatOpening({ openNow: true })).toBe('Ouvert');
    expect(formatOpening({ openNow: false, opensAt: '18:00' })).toBe('Fermé · ouvre à 18:00');
    expect(formatOpening({ openNow: false, opensAt: 'mar. 12:00' })).toBe(
      'Fermé · ouvre mar. 12:00',
    );
  });
});

describe('geo', () => {
  it('Grand-Place → gare Lille-Flandres ≈ 600 m', () => {
    const d = haversineMeters(GRAND_PLACE, { lat: 50.6365, lng: 3.0707 });
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(650);
  });

  it('estime au moins 1 minute de marche', () => {
    expect(estimateWalkMinutes(0)).toBe(1);
    expect(estimateWalkMinutes(800)).toBe(13);
  });
});
