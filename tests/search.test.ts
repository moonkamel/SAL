import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatLocalTime, mapPlace, toOpeningStatus } from '@/server/places';

// Deux lieux fictifs : un proche mais moyen, un plus loin et très bien noté.
const GOOGLE_RESPONSE = {
  places: [
    {
      id: 'far',
      displayName: { text: 'Sushi Loin' },
      formattedAddress: '1 rue Loin, 59000 Lille',
      location: { latitude: 50.66, longitude: 3.09 },
      rating: 4.8,
      userRatingCount: 900,
      priceLevel: 'PRICE_LEVEL_MODERATE',
      currentOpeningHours: { openNow: true, nextCloseTime: '2026-09-27T21:30:00Z' },
      photos: [
        {
          name: 'places/far/photos/abc',
          authorAttributions: [{ displayName: 'Jeanne', uri: 'https://maps.google.com/x' }],
        },
      ],
    },
    {
      id: 'near',
      displayName: { text: 'Sushi Près' },
      formattedAddress: '2 rue Près, 59000 Lille',
      location: { latitude: 50.6368, longitude: 3.0637 },
      rating: 4.2,
      userRatingCount: 300,
    },
  ],
};

const LOCATION = { lat: 50.6366, lng: 3.0635 };

describe('pipeline de recherche', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(GOOGLE_RESPONSE), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('appelle Text Search limité à Lille et un FieldMask minimal', async () => {
    const { search } = await import('@/server/search');
    await search({ query: 'manger japonais', location: LOCATION, filters: { openNow: true } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-key');
    expect(headers['X-Goog-FieldMask']).not.toContain('reviews');
    expect(headers['X-Goog-FieldMask']).toContain('places.currentOpeningHours');

    const body = JSON.parse(init.body as string);
    expect(body.textQuery).toBe('manger japonais'); // pas de clé Anthropic → requête brute
    expect(body.languageCode).toBe('fr');
    expect(body.openNow).toBe(true);
    expect(body.locationBias).toBeUndefined();
    expect(body.locationRestriction.rectangle).toEqual({
      low: { latitude: 50.6, longitude: 3.02 },
      high: { latitude: 50.658, longitude: 3.108 },
    });
  });

  it('calcule distance et marche, puis trie par score', async () => {
    const { search } = await import('@/server/search');
    const res = await search({ query: 'sushi', location: LOCATION });

    expect(res.rewritten).toBe(false);
    const scores = res.places.map((p) => p.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const near = res.places.find((p) => p.id === 'near')!;
    expect(near.distanceMeters).toBeLessThan(50);
    expect(near.walkMinutes).toBe(1);
    expect(near.sponsored).toBe(false);

    const far = res.places.find((p) => p.id === 'far')!;
    expect(far.distanceMeters).toBeGreaterThan(2500);
    expect(far.priceLevel).toBe(2);
    expect(far.photo?.attributions[0]?.displayName).toBe('Jeanne');
  });

  it('filtre par distance maximale', async () => {
    const { search } = await import('@/server/search');
    const res = await search({
      query: 'sushi',
      location: LOCATION,
      filters: { maxDistanceMeters: 1000 },
    });
    expect(res.places.map((p) => p.id)).toEqual(['near']);
  });

  it('met en cache les requêtes identiques (casse et espaces ignorés)', async () => {
    const { search } = await import('@/server/search');
    await search({ query: 'Sushi', location: LOCATION });
    await search({ query: '  sushi ', location: { lat: 50.63661, lng: 3.06348 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await search({ query: 'sushi', location: LOCATION, filters: { openNow: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('route API : 400 si la requête est vide, 200 sinon', async () => {
    const { POST } = await import('@/app/api/search+api');
    const bad = await POST(
      new Request('http://x/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: '', location: LOCATION }),
      }),
    );
    expect(bad.status).toBe(400);

    const ok = await POST(
      new Request('http://x/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'bar', location: LOCATION }),
      }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).places).toHaveLength(2);
  });

  it('route API : erreur Google → 502 avec message en français', async () => {
    fetchMock.mockImplementation(async () => new Response('quota', { status: 429 }));
    const { POST } = await import('@/app/api/search+api');
    const res = await POST(
      new Request('http://x/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'bar', location: LOCATION }),
      }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('La recherche Google Places a échoué');
  });
});

describe('horaires (heure de Lille)', () => {
  const now = new Date('2026-09-27T18:00:00Z'); // dimanche 20:00 à Lille

  it('affiche l’heure seule si c’est aujourd’hui', () => {
    expect(formatLocalTime('2026-09-27T21:30:00Z', now)).toBe('23:30');
  });

  it('ajoute le jour sinon', () => {
    expect(formatLocalTime('2026-09-29T10:00:00Z', now)).toBe('mar. 12:00');
  });

  it('fermeture dans la nuit : l’heure seule', () => {
    // Lundi 02:00 à Lille, dans 6 h : « ferme à 02:00 ».
    expect(formatLocalTime('2026-09-28T00:00:00Z', now)).toBe('02:00');
    // Lundi 09:00 : un autre jour, on garde le jour.
    expect(formatLocalTime('2026-09-28T07:00:00Z', now)).toBe('lun. 09:00');
  });

  it('ouvert / fermé', () => {
    expect(
      toOpeningStatus({ openNow: true, nextCloseTime: '2026-09-27T21:30:00Z' }, now),
    ).toEqual({ openNow: true, closesAt: '23:30' });
    expect(
      toOpeningStatus({ openNow: false, nextOpenTime: '2026-09-28T10:00:00Z' }, now),
    ).toEqual({ openNow: false, opensAt: 'lun. 12:00' });
    expect(toOpeningStatus(undefined, now)).toBeUndefined();
  });

  it('ignore les lieux sans position', () => {
    expect(mapPlace({ id: 'x', displayName: { text: 'X' } })).toBeNull();
  });
});
