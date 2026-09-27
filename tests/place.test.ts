import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapDetails, pickRecentReviews } from '@/server/places';

const PLACE_ID = 'ChIJ0cZ7h9fVwkcRzYxQ2b3Gm1A';

const review = (publishTime: string, name: string, text = 'Très bon') => ({
  rating: 5,
  relativePublishTimeDescription: 'il y a 1 mois',
  publishTime,
  text: { text },
  authorAttribution: { displayName: name, uri: `https://maps.google.com/${name}` },
});

const GOOGLE_PLACE = {
  id: PLACE_ID,
  displayName: { text: 'Le Japonais' },
  formattedAddress: '10 rue de la Clef, 59800 Lille',
  location: { latitude: 50.638, longitude: 3.064 },
  rating: 4.6,
  userRatingCount: 820,
  currentOpeningHours: {
    openNow: false,
    weekdayDescriptions: ['lundi: 12:00 – 14:00', 'mardi: Fermé'],
  },
  photos: Array.from({ length: 10 }, (_, i) => ({ name: `places/${PLACE_ID}/photos/p${i}` })),
  reviews: [
    review('2026-01-01T10:00:00Z', 'Ancien'),
    review('2026-09-01T10:00:00Z', 'Récent'),
    review('2026-05-01T10:00:00Z', 'Moyen'),
    review('2026-08-01T10:00:00Z', 'Sans texte', ''),
    review('2026-07-01T10:00:00Z', 'Juillet'),
  ],
  nationalPhoneNumber: '03 20 00 00 00',
  websiteUri: 'https://example.fr/',
};

describe('pickRecentReviews', () => {
  it('garde les 3 avis les plus récents, avec texte et auteur', () => {
    const reviews = pickRecentReviews(GOOGLE_PLACE.reviews);
    expect(reviews.map((r) => r.authorName)).toEqual(['Récent', 'Juillet', 'Moyen']);
    expect(reviews[0]?.authorUri).toBe('https://maps.google.com/Récent');
  });
});

describe('mapDetails', () => {
  it('limite les photos et expose horaires et contacts', () => {
    const d = mapDetails(GOOGLE_PLACE)!;
    expect(d.photos).toHaveLength(6);
    expect(d.weekdayHours).toEqual(['lundi: 12:00 – 14:00', 'mardi: Fermé']);
    expect(d.phone).toBe('03 20 00 00 00');
    expect(d.reviews).toHaveLength(3);
    expect(d).not.toHaveProperty('photo');
  });
});

describe('GET /api/place/:id', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(GOOGLE_PLACE), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const call = async (id: string, query = '') => {
    const { GET } = await import('@/app/api/place/[id]+api');
    return GET(new Request(`http://x/api/place/${id}${query}`), { id });
  };

  it('demande les avis en mode complet et pas en mode résumé', async () => {
    expect((await call(PLACE_ID)).status).toBe(200);
    expect((await call(PLACE_ID, '?fields=summary')).status).toBe(200);

    const masks = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers['X-Goog-FieldMask'],
    );
    expect(masks[0]).toContain('reviews');
    expect(masks[1]).not.toContain('reviews');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=fr&regionCode=FR`,
    );
  });

  it('met la fiche en cache', async () => {
    await call(PLACE_ID);
    await call(PLACE_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuse un identifiant invalide sans appeler Google', async () => {
    const res = await call('../../etc');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renvoie 404 si Google ne connaît pas le lieu', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 404 }));
    const res = await call(PLACE_ID);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Lieu introuvable');
  });
});
