import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  departuresAt,
  directionScore,
  parseDepartureTime,
  prettyName,
  recordsOf,
  sameStation,
  toPassage,
} from '@/server/ilevia';
import { ambianceOf, textSearchFieldMask } from '@/server/places';
import { hasAmbiance, withAmbianceHints } from '@/server/search';
import { feedUrls, mergeStations, nearestStations } from '@/server/vlille';

const GRAND_PLACE = { lat: 50.6366, lng: 3.0635 };

describe('V’Lille (GBFS)', () => {
  it('lit la liste des flux en GBFS 2.x et 3.0', () => {
    const v2 = { data: { fr: { feeds: [{ name: 'station_status', url: 'https://x/status' }] } } };
    const v3 = { data: { feeds: [{ name: 'station_information', url: 'https://x/info' }] } };
    expect(feedUrls(v2)).toEqual({ station_status: 'https://x/status' });
    expect(feedUrls(v3)).toEqual({ station_information: 'https://x/info' });
  });

  const info = [
    { station_id: '1', name: 'RIHOUR', lat: 50.6362, lon: 3.0619 },
    { station_id: '2', name: [{ text: 'GARE LILLE FLANDRES', language: 'fr' }], lat: 50.6365, lon: 3.0707 },
    { station_id: '3', name: 'HORS SERVICE', lat: 50.6367, lon: 3.0636 },
    { station_id: '4', name: 'SANS STATUT', lat: 50.6, lon: 3.0 },
  ];
  const status = [
    { station_id: '1', num_bikes_available: 4, num_docks_available: 12, is_renting: 1, is_returning: 1 },
    { station_id: '2', num_vehicles_available: 0, num_docks_available: 20, is_installed: true },
    { station_id: '3', num_bikes_available: 9, num_docks_available: 1, is_renting: false },
  ];

  it('joint infos et statuts, en GBFS 2.x comme 3.0', () => {
    const merged = mergeStations(info, status);
    expect(merged.map((s) => [s.name, s.bikes, s.docks, s.operational])).toEqual([
      ['RIHOUR', 4, 12, true],
      ['GARE LILLE FLANDRES', 0, 20, true],
      ['HORS SERVICE', 9, 1, false],
    ]);
  });

  it('trie par distance et écarte les stations hors service', () => {
    const near = nearestStations(mergeStations(info, status), GRAND_PLACE, 3);
    expect(near.map((s) => s.name)).toEqual(['RIHOUR', 'GARE LILLE FLANDRES']);
    expect(near[0]!.distanceMeters).toBeLessThan(150);
    expect(near[0]!.walkMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('Ilévia (prochains passages)', () => {
  const now = new Date('2026-09-27T19:00:00Z'); // 21:00 à Lille

  it('lit une heure sans fuseau comme l’heure de Lille', () => {
    expect(parseDepartureTime('2026-09-27T21:05:00')).toBe(Date.parse('2026-09-27T19:05:00Z'));
    expect(parseDepartureTime('2026-01-15T21:05:00')).toBe(Date.parse('2026-01-15T20:05:00Z'));
    expect(parseDepartureTime('2026-09-27T21:05:00+02:00')).toBe(Date.parse('2026-09-27T19:05:00Z'));
    expect(parseDepartureTime('2026-09-27T19:05:00Z')).toBe(Date.parse('2026-09-27T19:05:00Z'));
  });

  it('met en forme les noms en capitales', () => {
    expect(prettyName('REPUBLIQUE BEAUX ARTS')).toBe('Republique Beaux Arts');
    expect(prettyName("PORTE D'ARRAS")).toBe("Porte D'Arras");
  });

  // Format réel de la MEL (GeoServer, geometry nulle), relevé le 28/09/2026.
  const f = (station: string, line: string, dir: string, time: string) => ({
    type: 'Feature',
    geometry: null,
    properties: {
      identifiant_station: 'ILEVIA:StopPoint:BP:X:LOC',
      nom_station: station,
      code_ligne: line,
      sens_ligne: dir,
      heure_estimee_depart: time,
      commune: 'Lille',
    },
  });

  it('lit le format de la MEL et d’autres formats', () => {
    const expected = { station: 'RIHOUR', line: 'M1', direction: 'CHU EURASANTE', time: '2026-09-27T19:03:00Z' };
    expect(toPassage(f('RIHOUR', 'M1', 'CHU EURASANTE', '2026-09-27T19:03:00Z'))).toEqual(expected);
    expect(
      toPassage({ fields: { nomstation: 'RIHOUR', codeligne: 'M1', sensligne: 'CHU EURASANTE', heureestimeedepart: '2026-09-27T19:03:00Z' } }),
    ).toEqual(expected);
    expect(toPassage({ properties: { nom_station: 'X' } })).toBeNull();
    expect(recordsOf({ type: 'FeatureCollection', features: [1, 2] })).toHaveLength(2);
    expect(recordsOf({ records: [1] })).toHaveLength(1);
  });

  it('reconnaît un arrêt Google dans les noms Ilévia', () => {
    expect(sameStation('RIHOUR', 'Rihour')).toBe(true);
    expect(sameStation('REPUBLIQUE BEAUX ARTS', 'République - Beaux-Arts')).toBe(true);
    expect(sameStation('GARE LILLE FLANDRES', 'Gare Lille-Flandres Métro')).toBe(true);
    expect(sameStation('GARE LILLE EUROPE', 'Gare Lille Flandres')).toBe(false);
    expect(directionScore('CHU EURASANTE', 'Lille Chu - Eurasanté')).toBeCloseTo(2 / 3);
    expect(directionScore('QUATRE CANTONS', 'Lille Chu - Eurasanté')).toBe(0);
  });

  it('donne les prochains départs d’un arrêt, métro d’abord', () => {
    const deps = departuresAt(
      [
        f('RIHOUR', 'M1', 'CHU EURASANTE', '2026-09-27T21:07:00'),
        f('RIHOUR', 'M1', 'CHU EURASANTE', '2026-09-27T21:03:00'),
        f('RIHOUR', 'M1', 'QUATRE CANTONS', '2026-09-27T21:04:00'),
        f('RIHOUR', 'L1', 'LOMME', '2026-09-27T21:01:00'),
        f('RIHOUR', 'M1', 'CHU EURASANTE', '2026-09-27T20:55:00'), // passé
        f('GARE LILLE FLANDRES', 'M2', 'TOURCOING', '2026-09-27T21:02:00'), // autre arrêt
      ],
      'Rihour',
      now,
    );
    expect(deps).toEqual([
      { line: 'M1', direction: 'Chu Eurasante', minutes: [3, 7] },
      { line: 'M1', direction: 'Quatre Cantons', minutes: [4] },
      { line: 'L1', direction: 'Lomme', minutes: [1] },
    ]);
  });
});

describe('ambiances', () => {
  it('ne demande les champs d’ambiance à Google que s’ils sont filtrés', () => {
    expect(textSearchFieldMask()).not.toContain('outdoorSeating');
    const mask = textSearchFieldMask(['terrace', 'liveMusic']);
    expect(mask).toContain('places.outdoorSeating');
    expect(mask).toContain('places.liveMusic');
  });

  it('ne retient que les ambiances confirmées (true)', () => {
    expect(
      ambianceOf({ id: 'x', outdoorSeating: true, liveMusic: false, goodForGroups: true }),
    ).toEqual(['terrace', 'groups']);
    expect(hasAmbiance({ ambiance: ['terrace', 'groups'] }, ['terrace'])).toBe(true);
    expect(hasAmbiance({ ambiance: ['groups'] }, ['terrace'])).toBe(false);
    expect(hasAmbiance({}, [])).toBe(true);
  });

  it('lit l’accès fauteuil dans accessibilityOptions', () => {
    expect(textSearchFieldMask(['accessible'])).toContain('places.accessibilityOptions');
    expect(
      ambianceOf({ id: 'x', accessibilityOptions: { wheelchairAccessibleEntrance: true } }),
    ).toEqual(['accessible']);
    expect(
      ambianceOf({ id: 'x', accessibilityOptions: { wheelchairAccessibleEntrance: false } }),
    ).toEqual([]);
  });

  it('oriente la requête sans répéter un mot déjà présent', () => {
    expect(withAmbianceHints('bar calme', ['terrace', 'groups'])).toBe('bar calme terrasse');
    expect(withAmbianceHints('bar avec terrasse', ['terrace'])).toBe('bar avec terrasse');
  });
});

describe('recherche avec filtre d’ambiance', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () =>
      Response.json({
        places: [
          {
            id: 'ChIJwithTerrace01',
            displayName: { text: 'Avec terrasse' },
            location: { latitude: 50.637, longitude: 3.064 },
            outdoorSeating: true,
          },
          {
            id: 'ChIJnoTerrace0002',
            displayName: { text: 'Sans terrasse' },
            location: { latitude: 50.637, longitude: 3.064 },
            outdoorSeating: false,
          },
          {
            id: 'ChIJunknown000003',
            displayName: { text: 'Inconnu' },
            location: { latitude: 50.637, longitude: 3.064 },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('ne garde que les lieux dont Google confirme l’ambiance', async () => {
    const { search } = await import('@/server/search');
    const res = await search({
      query: 'bar',
      location: GRAND_PLACE,
      filters: { ambiance: ['terrace'] },
    });
    expect(res.places.map((p) => p.name)).toEqual(['Avec terrasse']);
    expect(res.places[0]!.ambiance).toEqual(['terrace']);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.textQuery).toBe('bar terrasse');
  });
});

describe('routes API V’Lille et Ilévia', () => {
  it('refusent une position invalide ou un arrêt manquant', async () => {
    const { GET: vlille } = await import('@/app/api/vlille+api');
    const { GET: transit } = await import('@/app/api/transit+api');
    expect((await vlille(new Request('http://x/api/vlille?near=abc'))).status).toBe(400);
    expect((await transit(new Request('http://x/api/transit'))).status).toBe(400);
  });

  it('interroge la MEL sans bbox (refusé par l’API) et partage la réponse', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [] })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/transit+api');
    expect(await (await GET(new Request('http://x/api/transit?stop=Rihour'))).json()).toEqual({
      stop: 'Rihour',
      departures: [],
    });
    await GET(new Request('http://x/api/transit?stop=Gambetta'));
    expect(fetchMock).toHaveBeenCalledTimes(1); // cache partagé
    const url = String((fetchMock.mock.calls[0] as unknown as [URL])[0]);
    expect(url).not.toContain('bbox');
    expect(url).toContain('f=application%2Fgeo%2Bjson');
    vi.unstubAllGlobals();
  });
});

describe('affichage V’Lille et Ilévia', async () => {
  const { formatWait, lineColor, pickStation } = await import('@/src/features/lille/pickers');
  const st = (name: string, bikes: number, docks: number) => ({
    id: name, name, location: GRAND_PLACE, bikes, docks, operational: true, distanceMeters: 100, walkMinutes: 2,
  });

  it('choisit la station la plus proche qui a un vélo ou une place', () => {
    const list = [st('A', 0, 5), st('B', 3, 0), st('C', 2, 2)];
    expect(pickStation(list, 'bikes')?.name).toBe('B');
    expect(pickStation(list, 'docks')?.name).toBe('A');
    expect(pickStation([st('A', 0, 0)], 'bikes')).toBeUndefined();
  });

  it('formate l’attente et colore les lignes', () => {
    expect(formatWait(0)).toBe('Maintenant');
    expect(formatWait(4)).toBe('4 min');
    expect(lineColor('M1')).not.toBe(lineColor('M2'));
    expect(lineColor('L1')).toBe('#5B6286');
  });
});
