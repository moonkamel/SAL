import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GOOGLE_TEST_UNITS, resolveAdUnit } from '@/src/features/ads/adUnits';
import { shouldShowInterstitial, withAdSlots } from '@/src/features/ads/policy';
import {
  loadCampaigns,
  matchingCampaigns,
  normalize,
  type SponsoredCampaign,
} from '@/server/sponsored';

const GRAND_PLACE = { lat: 50.6366, lng: 3.0635 };

const campaign = (over: Partial<SponsoredCampaign> = {}): SponsoredCampaign => ({
  id: 'c1',
  placeId: 'ChIJsponsoredPlace001',
  label: 'Test',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  zone: { lat: 50.6366, lng: 3.0635, radiusMeters: 3000 },
  keywords: ['japonais', 'sushi'],
  ...over,
});

describe('lieux sponsorisés : sélection des campagnes', () => {
  const now = new Date('2026-09-27T20:00:00Z');
  const ctx = { queries: ['Resto japonais'], location: GRAND_PLACE, now };

  it('normalise accents, casse et ponctuation', () => {
    expect(normalize('Boîte de NUIT !')).toBe('boite de nuit');
  });

  it('retient une campagne active, dans la zone, sur un mot-clé', () => {
    expect(matchingCampaigns([campaign()], ctx)).toHaveLength(1);
  });

  it('ignore une campagne hors dates', () => {
    expect(matchingCampaigns([campaign({ endDate: '2026-09-26' })], ctx)).toHaveLength(0);
    expect(matchingCampaigns([campaign({ startDate: '2026-09-28' })], ctx)).toHaveLength(0);
  });

  it('utilise la date de Lille (minuit passé à Paris, pas encore en UTC)', () => {
    const lateEvening = new Date('2026-09-30T22:30:00Z'); // 1er octobre 00:30 à Lille
    expect(matchingCampaigns([campaign()], { ...ctx, now: lateEvening })).toHaveLength(0);
  });

  it('ignore une campagne hors zone', () => {
    const roubaix = { lat: 50.6942, lng: 3.1746 };
    expect(matchingCampaigns([campaign()], { ...ctx, location: roubaix })).toHaveLength(0);
  });

  it('ne déclenche que sur des mots entiers', () => {
    expect(matchingCampaigns([campaign({ keywords: ['bar'] })], { ...ctx, queries: ['barbecue'] }))
      .toHaveLength(0);
    expect(matchingCampaigns([campaign({ keywords: ['bar'] })], { ...ctx, queries: ['un bar calme'] }))
      .toHaveLength(1);
  });

  it('tient compte de la requête reformulée', () => {
    expect(
      matchingCampaigns([campaign()], { ...ctx, queries: ['manger du poisson cru', 'sushi'] }),
    ).toHaveLength(1);
  });

  it('limite à 2 lieux et dédoublonne', () => {
    const list = [
      campaign({ id: 'a', placeId: 'ChIJplaceAAAAAAAA' }),
      campaign({ id: 'b', placeId: 'ChIJplaceAAAAAAAA' }),
      campaign({ id: 'c', placeId: 'ChIJplaceBBBBBBBB' }),
      campaign({ id: 'd', placeId: 'ChIJplaceCCCCCCCC' }),
    ];
    expect(matchingCampaigns(list, ctx).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('rejette un fichier de campagnes invalide', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadCampaigns([{ id: 'x' }])).toEqual([]);
    expect(loadCampaigns([campaign()])).toHaveLength(1);
  });
});

describe('lieux sponsorisés : dans la recherche', () => {
  const fetchMock = vi.fn();
  const place = (id: string, name: string) => ({
    id,
    displayName: { text: name },
    formattedAddress: 'Lille',
    location: { latitude: 50.637, longitude: 3.064 },
    rating: 4.5,
    userRatingCount: 100,
    currentOpeningHours: { openNow: true },
  });

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T18:00:00Z'));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('searchText')) {
        return Response.json({
          places: [place('ChIJorganicPlace01', 'Bio'), place('ChIJorganicPlace02', 'Autre')],
        });
      }
      return Response.json(place('ChIJsponsoredPlace001', 'Sponsor'));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.doUnmock('@/server/sponsored.json');
  });

  it('met le lieu sponsorisé en tête avec le badge, même absent des résultats', async () => {
    vi.doMock('@/server/sponsored.json', () => ({ default: [campaign()] }));
    const { search } = await import('@/server/search');
    const res = await search({ query: 'resto japonais', location: GRAND_PLACE });

    expect(res.places.map((p) => [p.name, p.sponsored])).toEqual([
      ['Sponsor', true],
      ['Bio', false],
      ['Autre', false],
    ]);
  });

  it('marque et remonte un lieu déjà présent sans le dupliquer', async () => {
    vi.doMock('@/server/sponsored.json', () => ({
      default: [campaign({ placeId: 'ChIJorganicPlace02' })],
    }));
    const { search } = await import('@/server/search');
    const res = await search({ query: 'sushi', location: GRAND_PLACE });
    expect(res.places.map((p) => [p.id, p.sponsored])).toEqual([
      ['ChIJorganicPlace02', true],
      ['ChIJorganicPlace01', false],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas d'appel Place Details en plus
  });

  it('respecte les filtres de l’utilisateur', async () => {
    vi.doMock('@/server/sponsored.json', () => ({ default: [campaign()] }));
    const { search } = await import('@/server/search');
    const res = await search({
      query: 'sushi',
      location: GRAND_PLACE,
      filters: { minRating: 4.8 },
    });
    expect(res.places.some((p) => p.sponsored)).toBe(false);
  });
});

describe('publicité', () => {
  it('insère une pub native après chaque groupe de 5 lieux, jamais en dernier', () => {
    const places = Array.from({ length: 12 }, (_, i) => i);
    const items = withAdSlots(places, true);
    expect(items.map((i) => (i.type === 'ad' ? 'AD' : i.place))).toEqual([
      0, 1, 2, 3, 4, 'AD', 5, 6, 7, 8, 9, 'AD', 10, 11,
    ]);
    expect(withAdSlots([0, 1, 2, 3, 4], true).some((i) => i.type === 'ad')).toBe(false);
    expect(withAdSlots(places, false).some((i) => i.type === 'ad')).toBe(false);
  });

  it('interstitiel : max une fois par session, jamais au lancement ni en guidage', () => {
    const base = {
      shownThisSession: false,
      searchesThisSession: 2,
      guidanceActive: false,
      canRequestAds: true,
    };
    expect(shouldShowInterstitial(base)).toBe(true);
    expect(shouldShowInterstitial({ ...base, searchesThisSession: 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, shownThisSession: true })).toBe(false);
    expect(shouldShowInterstitial({ ...base, guidanceActive: true })).toBe(false);
    expect(shouldShowInterstitial({ ...base, canRequestAds: false })).toBe(false);
  });

  it('IDs de test en développement, vrais IDs seulement en production', () => {
    const env = { EXPO_PUBLIC_ADMOB_ANDROID_BANNER: 'ca-app-pub-123/456' };
    expect(resolveAdUnit('banner', 'android', true, env)).toBe(GOOGLE_TEST_UNITS.android.banner);
    expect(resolveAdUnit('banner', 'android', false, env)).toBe('ca-app-pub-123/456');
    expect(resolveAdUnit('native', 'android', false, env)).toBe(GOOGLE_TEST_UNITS.android.native);
  });
});
