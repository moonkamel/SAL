import { describe, expect, it } from 'vitest';

import { computeUsage, type EventRow, TrackBody } from '@/server/analytics';

const ev = (session: string, minute: number, name: string, props: EventRow['props'] = {}): EventRow => ({
  name,
  props: { lang: session === 's2' ? 'en' : 'fr', ...props },
  session,
  created_at: `2026-10-05T18:${String(minute).padStart(2, '0')}:00.000Z`,
});

describe('statistiques d’usage', () => {
  const rows = [
    // Session 1 : recherche, fiche, itinéraire.
    ev('s1', 0, 'app_open'),
    ev('s1', 1, 'screen', { screen: '/' }),
    ev('s1', 2, 'search', { q: 'Salon de thé', n: 18 }),
    ev('s1', 3, 'screen', { screen: '/results' }),
    ev('s1', 4, 'screen', { screen: '/place/[id]' }),
    ev('s1', 5, 'directions', { mode: 'walking' }),
    // Session 2 : recherche sans résultat, puis quitte sur les résultats.
    ev('s2', 10, 'app_open'),
    ev('s2', 11, 'screen', { screen: '/' }),
    ev('s2', 12, 'search', { q: 'salon de thé', n: 0 }),
    ev('s2', 13, 'screen', { screen: '/results' }),
    // Session 3 : ouvre et repart de l'accueil.
    ev('s3', 20, 'app_open'),
    ev('s3', 21, 'screen', { screen: '/' }),
  ];
  const u = computeUsage(rows, 30);

  it('compte les sessions, langues et écrans', () => {
    expect(u.sessions).toBe(3);
    expect(u.perDay).toEqual([{ day: '2026-10-05', sessions: 3 }]);
    expect(u.languages).toEqual([
      { lang: 'fr', sessions: 2 },
      { lang: 'en', sessions: 1 },
    ]);
    expect(u.screens[0]).toEqual({ screen: '/', views: 3 });
  });

  it('regroupe les recherches et repère celles sans résultat', () => {
    expect(u.searches).toEqual([{ query: 'salon de thé', count: 2, avgResults: 9 }]);
    expect(u.emptySearches).toEqual([{ query: 'salon de thé', count: 1 }]);
  });

  it('calcule le parcours et les écrans de sortie', () => {
    expect(u.funnel.map((f) => f.sessions)).toEqual([3, 2, 1, 1]);
    expect(u.exits).toEqual(
      expect.arrayContaining([
        { screen: '/place/[id]', sessions: 1 },
        { screen: '/results', sessions: 1 },
        { screen: '/', sessions: 1 },
      ]),
    );
    expect(u.directions).toEqual([{ mode: 'walking', count: 1 }]);
  });

  it('refuse les envois invalides', () => {
    const ok = { session: 'abc12345', lang: 'fr', platform: 'android', events: [{ name: 'screen', props: { screen: '/' }, t: 1 }] };
    expect(TrackBody.safeParse(ok).success).toBe(true);
    expect(TrackBody.safeParse({ ...ok, events: [{ name: 'hack', t: 1 }] }).success).toBe(false);
    expect(TrackBody.safeParse({ ...ok, session: 'X' }).success).toBe(false);
    expect(TrackBody.safeParse({ ...ok, events: [] }).success).toBe(false);
  });
});
