import { describe, expect, it } from 'vitest';

import {
  journeyFromItinerary,
  journeyWithVlille,
  legDone,
  legIntro,
  legOutro,
  remainingAfter,
  type RideLeg,
  rideStatus,
} from '@/shared/journey';
import type { TransitItinerary, VlilleStation } from '@/shared/types';

const HOME = { lat: 50.6366, lng: 3.0635 };
const GASTON = { lat: 50.6245, lng: 3.0689 };
const REPUBLIQUE = { lat: 50.6305, lng: 3.0617 };
const DEST = { lat: 50.6318, lng: 3.0598 };
const L1 = { short: 'L1', name: 'Liane 1', color: '#2B3990', textColor: '#FFFFFF', vehicle: 'Bus' };

const ITINERARY: TransitItinerary = {
  id: 'x',
  departureTime: '2026-09-28T12:33:00Z',
  arrivalTime: '2026-09-28T12:54:00Z',
  durationSeconds: 1260,
  walkMeters: 570,
  fare: '1,80 €',
  segments: [
    { kind: 'walk', durationSeconds: 300, distanceMeters: 330, polyline: '', from: HOME, to: GASTON, toName: 'Gaston Berger' },
    {
      kind: 'ride',
      line: L1,
      headsign: 'Wambrechies Agrippin',
      departureStop: { name: 'Gaston Berger', location: GASTON },
      arrivalStop: { name: 'République Beaux-Arts', location: REPUBLIQUE },
      departureTime: '2026-09-28T12:38:00Z',
      arrivalTime: '2026-09-28T12:50:00Z',
      stopCount: 6,
      durationSeconds: 660,
      polyline: '',
    },
    { kind: 'walk', durationSeconds: 240, distanceMeters: 240, polyline: '', from: REPUBLIQUE, to: DEST, toName: 'Crowntea' },
  ],
};

const NOW = new Date('2026-09-28T12:34:00Z');

describe('voyage en transports', () => {
  const j = journeyFromItinerary(ITINERARY, 'place-1', 'Crowntea République');
  const ride = j.legs[1] as RideLeg;

  it('transforme le trajet en étapes à enchaîner', () => {
    expect(j.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk']);
    expect(j.legs[0]).toMatchObject({ toName: 'l’arrêt Gaston Berger', to: GASTON });
    expect(j.legs[2]).toMatchObject({ toName: 'Crowntea République' });
  });

  it('dit quoi faire à chaque étape', () => {
    expect(legIntro(j.legs[0]!, NOW)).toBe('Marchez jusqu’à l’arrêt Gaston Berger.');
    expect(legIntro(ride, NOW)).toBe('Prenez le bus L1 direction Wambrechies Agrippin. Départ dans 4 minutes.');
    expect(legIntro(ride, NOW, 2)).toContain('Départ dans 2 minutes.'); // temps réel
    expect(legOutro(ride, j.legs[2])).toBe('Descendez à République Beaux-Arts.');
  });

  it('suit l’étape en bus : attente, trajet, descente', () => {
    expect(rideStatus(ride, GASTON, NOW)).toMatchObject({ phase: 'waiting', title: 'Prenez le bus L1' });
    expect(rideStatus(ride, GASTON, NOW, 1).subtitle).toContain('dans 1 min (temps réel)');
    const between = { lat: 50.6275, lng: 3.0653 };
    expect(rideStatus(ride, between, new Date('2026-09-28T12:42:00Z'))).toMatchObject({
      phase: 'riding',
      title: 'Restez dans le bus L1',
    });
    const near = { lat: 50.6295, lng: 3.0625 };
    expect(rideStatus(ride, near, NOW)).toMatchObject({ phase: 'getoff', subtitle: 'République Beaux-Arts' });
  });

  it('sait quand une étape est terminée', () => {
    expect(legDone(j.legs[0]!, GASTON)).toBe(true);
    expect(legDone(j.legs[0]!, HOME)).toBe(false);
    expect(legDone(ride, { lat: 50.6308, lng: 3.0617 })).toBe(true);
  });

  it('estime le temps restant après l’étape en cours', () => {
    // Bus 12:38 → 12:50 (12 min) + 4 min de marche.
    expect(remainingAfter(j.legs, 0, NOW)).toBe(12 * 60 + 240);
    expect(remainingAfter(j.legs, 2, NOW)).toBe(0);
  });
});

describe('voyage en V’Lille', () => {
  const station = (id: string, name: string, lat: number, lng: number, extra: Partial<VlilleStation> = {}): VlilleStation => ({
    id,
    name,
    location: { lat, lng },
    bikes: 7,
    docks: 9,
    operational: true,
    distanceMeters: 150,
    walkMinutes: 2,
    ...extra,
  });

  it('à pied jusqu’à la station, à vélo, puis à pied', () => {
    const j = journeyWithVlille(
      station('1', 'RIHOUR', 50.6362, 3.0619),
      station('2', 'REPUBLIQUE', 50.6309, 3.0612),
      DEST,
      'p',
      'Crowntea',
    );
    expect(j.legs.map((l) => l.kind)).toEqual(['walk', 'bike', 'walk']);
    expect(j.legs[0]).toMatchObject({ toName: 'la station V’Lille RIHOUR', note: '7 vélos disponibles' });
    expect(j.legs[1]).toMatchObject({ toName: 'la station V’Lille REPUBLIQUE', note: '9 places libres' });
    expect(legIntro(j.legs[0]!, NOW)).toBe('Marchez jusqu’à la station V’Lille RIHOUR. 7 vélos disponibles.');
    expect(legOutro(j.legs[0]!, j.legs[1])).toBe('Prenez un vélo à la borne.');
    expect(legOutro(j.legs[1]!, j.legs[2])).toBe('Déposez votre vélo à la borne.');
  });

  it('vélo de bout en bout sans station utilisable', () => {
    expect(journeyWithVlille(undefined, undefined, DEST, 'p', 'X').legs).toEqual([
      { kind: 'bike', to: DEST, toName: 'X' },
    ]);
  });
});
