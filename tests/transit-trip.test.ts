import { describe, expect, it } from 'vitest';

import { type GRoute, mapItinerary, pickItineraries } from '@/server/itineraries';
import { currentSegment, distanceToLine, formatClock, liveInstruction, segmentPoints } from '@/shared/trip';
import { encodePolyline } from './helpers/polyline';

const RIHOUR = { lat: 50.6357, lng: 3.06291 };
const GAMBETTA = { lat: 50.62639, lng: 3.05212 };
const START = { lat: 50.6366, lng: 3.0635 };
const DEST = { lat: 50.6283, lng: 3.0447 };
const ll = (p: { lat: number; lng: number }) => ({ latLng: { latitude: p.lat, longitude: p.lng } });

// Réponse Google réduite, calquée sur un vrai trajet Grand-Place → Gambetta (M1).
const ROUTE: GRoute = {
  duration: '913s',
  localizedValues: { transitFare: { text: '1,80 €' } },
  legs: [
    {
      steps: [
        { travelMode: 'WALK', staticDuration: '60s', distanceMeters: 70, startLocation: ll(START), endLocation: ll({ lat: 50.6362, lng: 3.0629 }), polyline: { encodedPolyline: encodePolyline([START, { lat: 50.6362, lng: 3.0629 }]) } },
        { travelMode: 'WALK', staticDuration: '90s', distanceMeters: 60, startLocation: ll({ lat: 50.6362, lng: 3.0629 }), endLocation: ll(RIHOUR), polyline: { encodedPolyline: encodePolyline([{ lat: 50.6362, lng: 3.0629 }, RIHOUR]) } },
        {
          travelMode: 'TRANSIT',
          staticDuration: '150s',
          distanceMeters: 1400,
          startLocation: ll(RIHOUR),
          endLocation: ll(GAMBETTA),
          polyline: { encodedPolyline: encodePolyline([RIHOUR, GAMBETTA]) },
          transitDetails: {
            stopDetails: {
              departureStop: { name: 'Rihour', location: ll(RIHOUR) },
              arrivalStop: { name: 'Gambetta', location: ll(GAMBETTA) },
              departureTime: '2026-09-28T10:40:09Z',
              arrivalTime: '2026-09-28T10:42:39Z',
            },
            headsign: 'Lille Chu - Eurasanté',
            stopCount: 2,
            transitLine: { name: 'Metro Ligne 1', nameShort: 'M1', color: '#f2bc1e', textColor: '#000000', vehicle: { type: 'SUBWAY' } },
          },
        },
        { travelMode: 'WALK', staticDuration: '540s', distanceMeters: 700, startLocation: ll(GAMBETTA), endLocation: ll(DEST), polyline: { encodedPolyline: encodePolyline([GAMBETTA, DEST]) } },
      ],
    },
  ],
};

const NOW = new Date('2026-09-28T10:30:00Z');

describe('trajets en transports', () => {
  it('fusionne la marche et lit ligne, arrêts, horaires et tarif', () => {
    const it = mapItinerary(ROUTE, 'L’origine du thé', NOW)!;
    expect(it.fare).toBe('1,80 €');
    expect(it.segments.map((s) => s.kind)).toEqual(['walk', 'ride', 'walk']);
    const [walk, ride, last] = it.segments;
    expect(walk).toMatchObject({ kind: 'walk', durationSeconds: 150, distanceMeters: 130, toName: 'Rihour' });
    expect(ride).toMatchObject({
      kind: 'ride',
      line: { short: 'M1', color: '#F2BC1E', textColor: '#000000', vehicle: 'Métro' },
      headsign: 'Lille Chu - Eurasanté',
      stopCount: 2,
      departureStop: { name: 'Rihour' },
      arrivalStop: { name: 'Gambetta' },
    });
    expect(last).toMatchObject({ kind: 'walk', toName: 'L’origine du thé' });
    // Départ = métro moins 2 min 30 de marche ; arrivée = métro + 9 min de marche.
    expect(it.departureTime).toBe('2026-09-28T10:37:39.000Z');
    expect(it.arrivalTime).toBe('2026-09-28T10:51:39.000Z');
    expect(it.walkMeters).toBe(830);
    // Les deux tracés à pied sont assemblés puis décodés.
    expect(segmentPoints(walk!)).toHaveLength(4);
  });

  it('ignore les trajets tout à pied et les doublons', () => {
    const walkOnly: GRoute = { legs: [{ steps: [ROUTE.legs![0]!.steps![0]!] }] };
    expect(mapItinerary(walkOnly, 'X', NOW)).toBeNull();
    const a = mapItinerary(ROUTE, 'X', NOW);
    expect(pickItineraries([a, a, null])).toHaveLength(1);
  });

  it('regroupe les départs suivants du même trajet', () => {
    const at = (iso: string) => {
      const r = structuredClone(ROUTE);
      const td = r.legs![0]!.steps![2]!.transitDetails!;
      td.stopDetails!.departureTime = iso;
      td.stopDetails!.arrivalTime = new Date(Date.parse(iso) + 150_000).toISOString();
      return mapItinerary(r, 'X', NOW);
    };
    const list = pickItineraries([at('2026-09-28T10:44:00Z'), at('2026-09-28T10:40:00Z'), at('2026-09-28T10:42:00Z')]);
    expect(list).toHaveLength(1);
    expect(list[0]!.nextDepartures).toEqual(['2026-09-28T10:42:00Z', '2026-09-28T10:44:00Z']);
  });

  it('mesure la distance à un tracé', () => {
    const mid = { lat: (RIHOUR.lat + GAMBETTA.lat) / 2, lng: (RIHOUR.lng + GAMBETTA.lng) / 2 };
    expect(distanceToLine(mid, [RIHOUR, GAMBETTA])).toBeLessThan(1);
    expect(distanceToLine(START, [RIHOUR, GAMBETTA])).toBeGreaterThan(50);
  });
});

describe('accompagnement en direct', () => {
  const trip = mapItinerary(ROUTE, 'L’origine du thé', NOW)!;

  it('dit où marcher et quand part le métro', () => {
    const live = liveInstruction(trip, 0, START, 'L’origine du thé', NOW);
    expect(live.title).toBe('Marchez jusqu’à Rihour');
    expect(live.subtitle).toContain(`Métro M1 à ${formatClock('2026-09-28T10:40:09Z')} (dans 10 min)`);
    expect(live.alert).toBeUndefined();
    // Le métro part dans 1 min et il reste 2 min de marche : « pressez le pas ».
    expect(liveInstruction(trip, 0, START, 'X', new Date('2026-09-28T10:39:00Z')).alert).toBe('hurry');
  });

  it('avance d’étape en étape et prévient avant de descendre', () => {
    // À l'arrêt Rihour : on attend le métro.
    expect(currentSegment(trip, RIHOUR, 0)).toBe(1);
    expect(liveInstruction(trip, 1, RIHOUR, 'X', NOW).title).toBe('Attendez le Métro M1');
    // Dans le métro, à ~300 m de Gambetta : alerte.
    const near = { lat: 50.6285, lng: 3.0546 };
    const live = liveInstruction(trip, 1, near, 'X', new Date('2026-09-28T10:42:00Z'));
    expect(live).toMatchObject({ title: 'Descendez au prochain arrêt', alert: 'prepare' });
    // Descendu à Gambetta : dernière marche.
    expect(currentSegment(trip, GAMBETTA, 1)).toBe(2);
    // Jamais de retour en arrière.
    expect(currentSegment(trip, START, 2)).toBe(2);
  });
});

describe('guidage de secours', () => {
  it('ouvre Google Maps à pied vers la destination', async () => {
    const { googleMapsDirections } = await import('@/src/features/navigation/googleMaps');
    expect(googleMapsDirections({ lat: 50.63, lng: 3.06 }, 'walk')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=50.63,3.06&travelmode=walking&dir_action=navigate',
    );
  });
});
