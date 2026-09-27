import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shareMessage } from '@/shared/share';
import {
  conditionFromCode,
  parisHour,
  pickAmongTop,
  surpriseQueries,
  weatherSuggestion,
} from '@/shared/suggest';
import type { PlaceSummary, Weather } from '@/shared/types';

const LOCATION = { lat: 50.6366, lng: 3.0635 };
const sunny: Weather = { temperature: 22, condition: 'clear', isDay: true };
const rainy: Weather = { temperature: 12, condition: 'rain', isDay: true };

describe('météo', () => {
  it('traduit les codes WMO', () => {
    expect(conditionFromCode(0)).toBe('clear');
    expect(conditionFromCode(3)).toBe('cloudy');
    expect(conditionFromCode(45)).toBe('fog');
    expect(conditionFromCode(61)).toBe('rain');
    expect(conditionFromCode(81)).toBe('rain');
    expect(conditionFromCode(73)).toBe('snow');
    expect(conditionFromCode(95)).toBe('storm');
  });

  it('lit la réponse Open-Meteo', async () => {
    const { parseWeather } = await import('@/server/weather');
    expect(
      parseWeather({ current: { temperature_2m: 18.4, weather_code: 2, is_day: 0 } }),
    ).toEqual({ temperature: 18.4, condition: 'cloudy', isDay: false });
    expect(() => parseWeather({})).toThrow();
  });

  it('propose l’estaminet sous la pluie et la terrasse au soleil', () => {
    expect(weatherSuggestion(rainy, 20).query).toBe('estaminet');
    const sun = weatherSuggestion(sunny, 19);
    expect(sun.ambiance).toEqual(['terrace']);
    expect(sun.title).toContain('22 °C');
    expect(weatherSuggestion({ temperature: 2, condition: 'cloudy', isDay: true }, 15).query).toBe(
      'estaminet',
    );
    expect(weatherSuggestion({ temperature: 12, condition: 'cloudy', isDay: true }, 9).query).toBe(
      'brunch',
    );
  });

  it('donne l’heure de Lille quel que soit le fuseau du serveur', () => {
    expect(parisHour(new Date('2026-07-01T20:30:00Z'))).toBe(22); // heure d'été
    expect(parisHour(new Date('2026-01-15T23:30:00Z'))).toBe(0); // heure d'hiver
  });
});

describe('Surprends-moi', () => {
  it('adapte les requêtes à l’heure et au temps', () => {
    expect(surpriseQueries(8).queries).toContain('café');
    expect(surpriseQueries(20).queries).toContain('estaminet');
    expect(surpriseQueries(1).queries).toContain('bar');
    expect(surpriseQueries(15, sunny).ambiance).toEqual(['terrace']);
    expect(surpriseQueries(1, sunny).ambiance).toBeUndefined();
    expect(surpriseQueries(15, rainy).queries).toContain('salon de thé');
  });

  it('tire au sort parmi les 5 premiers seulement', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(pickAmongTop(items, 5, () => 0)).toBe(1);
    expect(pickAmongTop(items, 5, () => 0.999)).toBe(5);
    expect(pickAmongTop([], 5)).toBeUndefined();
  });

  it('écarte les lieux fermés, peu notés ou sponsorisés', async () => {
    const { surpriseCandidates, surpriseReason } = await import('@/server/surprise');
    const base: PlaceSummary = {
      id: 'ok',
      name: 'OK',
      address: '',
      location: LOCATION,
      rating: 4.6,
      userRatingCount: 200,
      opening: { openNow: true },
      distanceMeters: 400,
      walkMinutes: 5,
      sponsored: false,
      score: 1,
    };
    const places: PlaceSummary[] = [
      base,
      { ...base, id: 'closed', opening: { openNow: false } },
      { ...base, id: 'low', rating: 3.9 },
      { ...base, id: 'few', userRatingCount: 4 },
      { ...base, id: 'ad', sponsored: true },
    ];
    expect(surpriseCandidates(places).map((p) => p.id)).toEqual(['ok']);
    expect(surpriseReason(base)).toBe('Ouvert · 4,6 ★ · ~5 min à pied');
  });

  describe('de bout en bout (Google et Open-Meteo simulés)', () => {
    const fetchMock = vi.fn();
    const google = {
      places: [
        {
          id: 'estaminet',
          displayName: { text: 'Estaminet du coin' },
          formattedAddress: '1 rue de la Monnaie, 59000 Lille',
          location: { latitude: 50.6375, longitude: 3.0645 },
          rating: 4.6,
          userRatingCount: 820,
          currentOpeningHours: { openNow: true },
        },
      ],
    };

    beforeEach(() => {
      vi.resetModules();
      fetchMock.mockReset();
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes('open-meteo')
          ? new Response(
              JSON.stringify({ current: { temperature_2m: 11, weather_code: 63, is_day: 1 } }),
            )
          : new Response(JSON.stringify(google)),
      );
      vi.stubGlobal('fetch', fetchMock);
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
      vi.stubEnv('ANTHROPIC_API_KEY', '');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it('renvoie un lieu ouvert et bien noté, en évitant la terrasse sous la pluie', async () => {
      const { surprise } = await import('@/server/surprise');
      const res = await surprise(LOCATION, {
        date: new Date('2026-09-27T18:00:00Z'), // 20 h à Lille
        random: () => 0,
      });
      expect(res?.place.id).toBe('estaminet');
      expect(res?.reason).toMatch(/^Ouvert · 4,6 ★/);
      const googleCall = fetchMock.mock.calls.find(([u]) => String(u).includes('places:searchText'));
      const body = JSON.parse((googleCall?.[1] as RequestInit).body as string);
      expect(body.openNow).toBe(true);
      expect(['estaminet', 'restaurant']).toContain(body.textQuery);
    });

    it('répond 404 quand rien ne convient', async () => {
      google.places[0]!.currentOpeningHours = { openNow: false };
      const { GET } = await import('@/app/api/surprise+api');
      const res = await GET(new Request('http://x/api/surprise?near=50.6366,3.0635'));
      expect(res.status).toBe(404);
      google.places[0]!.currentOpeningHours = { openNow: true };
    });

    it('/api/weather renvoie la météo et une suggestion', async () => {
      const { GET } = await import('@/app/api/weather+api');
      const res = await GET(new Request('http://x/api/weather?near=50.6366,3.0635'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.weather).toEqual({ temperature: 11, condition: 'rain', isDay: true });
      expect(body.suggestion.query).toBeTruthy();
    });

    it('refuse hors de la métropole', async () => {
      const { GET } = await import('@/app/api/surprise+api');
      const res = await GET(new Request('http://x/api/surprise?near=48.85,2.35'));
      expect(res.status).toBe(422);
    });
  });
});

describe('partage', () => {
  it('compose un message lisible avec le lien', () => {
    const msg = shareMessage(
      {
        name: 'Estaminet du coin',
        address: '1 rue de la Monnaie, 59000 Lille',
        rating: 4.6,
        googleMapsUri: 'https://maps.google.com/?cid=1',
      },
      undefined,
    );
    expect(msg).toBe(
      'Estaminet du coin\n1 rue de la Monnaie, 59000 Lille\n4,6 ★ sur Google\n\nhttps://maps.google.com/?cid=1\n\nTrouvé avec Sortir à Lille',
    );
    expect(shareMessage({ name: 'A', address: 'B' }, 'https://app/place/x')).toContain(
      'https://app/place/x',
    );
  });
});
