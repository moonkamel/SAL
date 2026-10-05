import { describe, expect, it } from 'vitest';

import { googleMapsTour } from '@/src/features/navigation/googleMaps';
import { braderieSaturday, MUST_SEE, orderByProximity, SEASONAL, TOURS, tourPoints } from '@/shared/discover';

describe('Découvrir Lille', () => {
  it('Braderie : premier week-end de septembre, annoncée 3 semaines avant', () => {
    expect(braderieSaturday(2026).getDate()).toBe(5);
    expect(braderieSaturday(2027).getDate()).toBe(4);
    const braderie = SEASONAL.find((s) => s.id === 'braderie')!;
    expect(braderie.active(new Date(2026, 7, 20))).toBe(true);
    expect(braderie.active(new Date(2026, 8, 6, 20))).toBe(true);
    expect(braderie.active(new Date(2026, 8, 8))).toBe(false);
    expect(braderie.active(new Date(2026, 6, 1))).toBe(false);
  });

  it('marché de Noël : du 15 novembre à fin décembre', () => {
    const noel = SEASONAL.find((s) => s.id === 'noel')!;
    expect(noel.active(new Date(2026, 10, 20))).toBe(true);
    expect(noel.active(new Date(2026, 11, 31))).toBe(true);
    expect(noel.active(new Date(2026, 9, 5))).toBe(false);
  });

  it('chaque parcours tient dans une seule ouverture de Google Maps (9 étapes)', () => {
    for (const tour of TOURS) {
      for (const day of tour.days) expect(tourPoints(day.stops).length).toBeLessThanOrEqual(9);
    }
    expect(MUST_SEE.length).toBeGreaterThan(5);
  });

  it('ordonne au plus court depuis la position', () => {
    const p = (id: string, lat: number) => ({ id, location: { lat, lng: 3.06 } });
    const ordered = orderByProximity({ lat: 50.6, lng: 3.06 }, [p('loin', 50.7), p('près', 50.61), p('milieu', 50.65)]);
    expect(ordered.map((x) => x.id)).toEqual(['près', 'milieu', 'loin']);
  });

  it('lien Google Maps : destination finale et étapes intermédiaires', () => {
    const url = new URL(googleMapsTour([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }]));
    expect(url.searchParams.get('destination')).toBe('5,6');
    expect(url.searchParams.get('waypoints')).toBe('1,2|3,4');
    expect(url.searchParams.get('travelmode')).toBe('walking');
  });
});
