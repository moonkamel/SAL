import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapRoute, transitLines } from '@/server/routes';
import { formatArrival, formatDuration } from '@/shared/format';
import { decodePolyline } from '@/shared/polyline';

describe('decodePolyline', () => {
  it('décode l’exemple de la documentation Google', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('renvoie un tableau vide pour un tracé vide', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('formatDuration / formatArrival', () => {
  it('durées', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(499)).toBe('8 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 05');
  });

  it('heure d’arrivée', () => {
    expect(formatArrival(600, new Date(2026, 8, 27, 20, 25))).toBe('20:35');
    expect(formatArrival(3600, new Date(2026, 8, 27, 23, 30))).toBe('00:30');
  });
});

describe('mapRoute', () => {
  it('lit durée, distance et tracé', () => {
    expect(
      mapRoute('walk', { duration: '499s', distanceMeters: 599, polyline: { encodedPolyline: 'abc' } }),
    ).toEqual({ mode: 'walk', available: true, durationSeconds: 499, distanceMeters: 599, polyline: 'abc' });
  });

  it('marque le mode indisponible sans itinéraire', () => {
    expect(mapRoute('bicycle', undefined)).toEqual({ mode: 'bicycle', available: false });
  });

  it('liste les lignes de transport sans doublon', () => {
    const line = (type: string, nameShort: string) => ({
      transitDetails: { transitLine: { nameShort, vehicle: { type } } },
    });
    expect(
      transitLines({
        legs: [{ steps: [{}, line('SUBWAY', '1'), line('TRAM', 'R'), line('SUBWAY', '1')] }],
      }),
    ).toEqual(['Métro 1', 'Tram R']);
  });
});

describe('GET /api/route', () => {
  const fetchMock = vi.fn();
  const googleRoute = {
    routes: [{ duration: '600s', distanceMeters: 800, polyline: { encodedPolyline: 'xyz' } }],
  };

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      // Pas de vélo dans ce scénario : Google ne renvoie aucun itinéraire.
      if (body.travelMode === 'BICYCLE') return new Response('{}', { status: 200 });
      return new Response(JSON.stringify(googleRoute), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const call = async (query: string) => {
    const { GET } = await import('@/app/api/route+api');
    return GET(new Request(`http://x/api/route?${query}`));
  };

  it('calcule les 4 modes en parallèle et met en cache', async () => {
    const res = await call('from=50.6366,3.0635&to=50.6365,3.0707');
    expect(res.status).toBe(200);
    const { options } = await res.json();
    expect(options.map((o: { mode: string; available: boolean }) => [o.mode, o.available])).toEqual([
      ['walk', true],
      ['bicycle', false],
      ['drive', true],
      ['transit', true],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const modes = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).travelMode);
    expect(modes).toEqual(['WALK', 'BICYCLE', 'DRIVE', 'TRANSIT']);

    await call('from=50.63661,3.06351&to=50.6365,3.0707');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('refuse des coordonnées invalides ou trop éloignées', async () => {
    expect((await call('from=abc&to=50,3')).status).toBe(400);
    expect((await call('from=50.63,3.06&to=48.85,2.35')).status).toBe(400); // Paris
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explique une clé sans Routes API', async () => {
    fetchMock.mockImplementation(async () => new Response('denied', { status: 403 }));
    const res = await call('from=50.6366,3.0635&to=50.6365,3.0707');
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('Routes API non activée pour cette clé');
  });
});
