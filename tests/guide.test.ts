import { describe, expect, it } from 'vitest';

import { dueAnnouncements, formatGuideDistance, isOffRoute, parseMapboxRoute, progressOn } from '@/shared/guide';

// Trajet en L au format Mapbox Directions : 200 m vers l'est, puis 100 m vers le nord.
const A = [3.06, 50.636];
const B = [3.0628, 50.636]; // ~200 m à l'est
const C = [3.0628, 50.6369]; // ~100 m au nord
const MAPBOX = {
  routes: [
    {
      distance: 300,
      duration: 240,
      geometry: { coordinates: [A, B, C] },
      legs: [
        {
          steps: [
            {
              distance: 200,
              duration: 160,
              name: 'Rue Esquermoise',
              maneuver: { type: 'depart', instruction: 'Marchez vers l’est sur Rue Esquermoise' },
              voiceInstructions: [
                { distanceAlongGeometry: 200, announcement: 'Marchez vers l’est sur Rue Esquermoise.' },
                { distanceAlongGeometry: 50, announcement: 'Dans 50 mètres, tournez à gauche sur Rue de la Monnaie.' },
              ],
              bannerInstructions: [
                { distanceAlongGeometry: 200, primary: { text: 'Rue de la Monnaie', type: 'turn', modifier: 'left' } },
              ],
            },
            {
              distance: 100,
              duration: 80,
              name: 'Rue de la Monnaie',
              maneuver: { type: 'turn', modifier: 'left', instruction: 'Tournez à gauche sur Rue de la Monnaie' },
              voiceInstructions: [{ distanceAlongGeometry: 30, announcement: 'Vous arrivez à destination.' }],
              bannerInstructions: [{ distanceAlongGeometry: 100, primary: { text: 'Destination', type: 'arrive' } }],
            },
            { distance: 0, duration: 0, maneuver: { type: 'arrive', instruction: 'Vous êtes arrivé' } },
          ],
        },
      ],
    },
  ],
};

const at = (lng: number, lat: number) => ({ lat, lng });

describe('guidage Mapbox', () => {
  const route = parseMapboxRoute(MAPBOX)!;

  it('lit l’itinéraire, ses étapes et ses annonces', () => {
    expect(route.coords).toHaveLength(3);
    expect(route.cum[2]).toBeGreaterThan(290);
    expect(route.steps[0]).toMatchObject({
      banner: 'Rue de la Monnaie',
      maneuver: { type: 'turn', modifier: 'left' },
      start: 0,
      street: 'Rue Esquermoise',
    });
    expect(route.steps[1]!.start).toBe(200);
    expect(parseMapboxRoute({ routes: [] })).toBeNull();
  });

  it('suit la position le long du tracé', () => {
    const p = progressOn(route, at(3.0614, 50.636)); // au milieu du 1er tronçon
    expect(p.step).toBe(0);
    expect(p.toManeuver).toBeGreaterThan(80);
    expect(p.toManeuver).toBeLessThan(120);
    expect(p.offset).toBeLessThan(3);
    expect(p.arrived).toBe(false);
    const q = progressOn(route, at(3.0628, 50.6365), p.along); // sur le 2e tronçon
    expect(q.step).toBe(1);
    expect(progressOn(route, at(3.0628, 50.6369)).arrived).toBe(true);
  });

  it('annonce la manœuvre au bon moment, une seule fois', () => {
    const spoken = new Set<string>();
    const start = progressOn(route, at(3.06, 50.636));
    expect(dueAnnouncements(route, start, spoken)).toEqual(['Marchez vers l’est sur Rue Esquermoise.']);
    expect(dueAnnouncements(route, start, spoken)).toEqual([]);
    const near = progressOn(route, at(3.0622, 50.636)); // ~45 m du virage
    expect(dueAnnouncements(route, near, spoken)).toEqual([
      'Dans 50 mètres, tournez à gauche sur Rue de la Monnaie.',
    ]);
  });

  it('détecte un écart d’itinéraire', () => {
    const off = progressOn(route, at(3.0614, 50.6366)); // ~65 m au nord de la rue
    expect(isOffRoute(off, 8)).toBe(true);
    expect(isOffRoute(progressOn(route, at(3.0614, 50.6361)), 8)).toBe(false);
    // GPS imprécis (60 m) : on ne recalcule pas pour rien.
    expect(isOffRoute(off, 60)).toBe(false);
  });

  it('formate les distances', () => {
    expect(formatGuideDistance(143)).toBe('140 m');
    expect(formatGuideDistance(3)).toBe('10 m');
    expect(formatGuideDistance(1250)).toBe('1,3 km');
  });
});
