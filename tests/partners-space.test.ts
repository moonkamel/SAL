import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendaEvent } from '@/shared/types';

import {
  fromOpenAgenda,
  fromPartnerEvent,
  guessCategory,
  isCulturalHighlight,
  openAgendaConfig,
  openAgendaPractical,
  outingDays,
  sortEvents,
  windowFor,
} from '@/server/agenda';
import { safeEqual } from '@/server/admin';
import { offerToday, selectOffersNear } from '@/server/offers';
import { addDays, parisParts, parisTime } from '@/server/paris';
import { allow, resetRateLimits } from '@/server/rateLimit';
import { type EventItem, type OfferItem, validItems } from '@/server/schemas';
import { roundCoord } from '@/server/search';
import { emptyValues, KINDS, toItem, toValues } from '@/src/features/admin/fields';

const GRAND_PLACE = { lat: 50.6366, lng: 3.0635 };
// Samedi 27 septembre 2026, 20 h 00 à Lille (UTC+2).
const SAT_20H = new Date('2026-09-27T18:00:00Z');

describe('H : économies Google', () => {
  it('mutualise le cache de recherche sur ~500 m', () => {
    expect(roundCoord(50.6366)).toBe(roundCoord(50.6352));
    expect(roundCoord(50.6366)).not.toBe(roundCoord(50.6466));
  });

  it('limite le nombre d’appels par minute et par appareil', () => {
    resetRateLimits();
    for (let i = 0; i < 10; i++) expect(allow('surprise', 'ip1', 0)).toBe(true);
    expect(allow('surprise', 'ip1', 1000)).toBe(false);
    expect(allow('surprise', 'ip2', 1000)).toBe(true); // autre appareil
    expect(allow('surprise', 'ip1', 61_000)).toBe(true); // nouvelle minute
  });
});

describe('heure de Lille', () => {
  it('convertit une heure locale en instant, été comme hiver', () => {
    expect(parisTime('2026-07-01', 21).toISOString()).toBe('2026-07-01T19:00:00.000Z');
    expect(parisTime('2026-01-15', 21).toISOString()).toBe('2026-01-15T20:00:00.000Z');
    expect(parisParts(SAT_20H)).toEqual({ date: '2026-09-27', day: 0, minutes: 1200 });
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

const offer = (over: Partial<OfferItem> = {}): OfferItem => ({
  id: 'happy-hour',
  placeId: 'ChIJ_illustration_01',
  placeName: 'L’Illustration',
  location: { lat: 50.6395, lng: 3.0585 },
  title: '2 bières pour le prix d’1',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  active: true,
  ...over,
});

describe('J : bons plans', () => {
  it('respecte les dates, les jours et le créneau', () => {
    expect(offerToday(offer(), SAT_20H)).toEqual({ live: true, schedule: 'Toute la journée' });
    expect(offerToday(offer({ endDate: '2026-09-26' }), SAT_20H)).toBeNull();
    expect(offerToday(offer({ days: [5, 6] }), SAT_20H)).toBeNull(); // dimanche 27/09
    expect(offerToday(offer({ active: false }), SAT_20H)).toBeNull();

    const later = offerToday(offer({ startTime: '21:00', endTime: '23:00' }), SAT_20H);
    expect(later).toEqual({ live: false, schedule: 'Aujourd’hui de 21h00 à 23h00' });
    const now = offerToday(offer({ startTime: '18:00', endTime: '21:00' }), SAT_20H);
    expect(now?.live).toBe(true);
    expect(offerToday(offer({ startTime: '17:00', endTime: '19:00' }), SAT_20H)).toBeNull(); // terminé
    expect(offerToday(offer({ startTime: '22:00', endTime: '02:00' }), SAT_20H)?.live).toBe(false);
  });

  it('trie du plus proche au plus loin', () => {
    const list = selectOffersNear(
      [
        offer({ id: 'loin', location: { lat: 50.65, lng: 3.07 } }),
        offer({ id: 'plus-tard', startTime: '22:00', endTime: '23:00' }),
        offer({ id: 'pres', location: { lat: 50.6368, lng: 3.0637 } }),
        offer({ id: 'hors-zone', location: { lat: 50.9, lng: 3.3 } }),
      ],
      GRAND_PLACE,
      SAT_20H,
    );
    expect(list.map((o) => o.id)).toEqual(['pres', 'plus-tard', 'loin']);
    expect(list[0]?.distanceMeters).toBeLessThan(50);
  });
});

const event = (over: Partial<EventItem> = {}): EventItem => ({
  id: 'concert-aeronef',
  title: 'Concert à l’Aéronef',
  category: 'concert',
  venueName: 'L’Aéronef',
  location: { lat: 50.6377, lng: 3.0755 },
  start: '2026-09-27T21:00:00+02:00',
  end: '2026-09-27T23:30:00+02:00',
  featured: false,
  active: true,
  ...over,
});

describe('K : agenda', () => {
  it('calcule les fenêtres « ce soir », « demain » et « week-end »', () => {
    const today = windowFor('today', SAT_20H);
    expect(today.end.toISOString()).toBe('2026-09-28T04:00:00.000Z'); // lundi 6 h
    // À 1 h du matin, « ce soir » est encore la soirée en cours.
    const oneAm = new Date('2026-09-27T23:00:00Z');
    expect(windowFor('today', oneAm).end.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    expect(windowFor('tomorrow', SAT_20H).start.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    // Un mercredi : le week-end commence vendredi 18 h.
    const wed = new Date('2026-09-23T10:00:00Z');
    const we = windowFor('weekend', wed);
    expect(we.start.toISOString()).toBe('2026-09-25T16:00:00.000Z');
    expect(we.end.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    // Un samedi soir : le week-end en cours, à partir de maintenant.
    const sat = new Date('2026-09-26T19:00:00Z');
    expect(windowFor('weekend', sat).start).toEqual(sat);
  });

  it('découpe la fenêtre en journées entières (6 h → 6 h)', () => {
    // Lundi 15 h : « aujourd'hui » redemande toute la journée depuis 6 h.
    const mon15 = new Date('2026-09-28T13:00:00Z');
    const today = outingDays(windowFor('today', mon15));
    expect(today).toHaveLength(1);
    expect(today[0]!.start.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    // La semaine : du lundi au dimanche, 7 journées.
    const week = outingDays(windowFor('week', mon15));
    expect(week).toHaveLength(7);
    expect(week[6]!.end.toISOString()).toBe('2026-10-05T04:00:00.000Z');
    // À 1 h du matin, on est encore dans la journée de la veille.
    const oneAm = new Date('2026-09-28T23:00:00Z');
    expect(outingDays(windowFor('today', oneAm))[0]!.start.toISOString()).toBe('2026-09-28T04:00:00.000Z');
  });

  it('calcule « cette semaine » et « la semaine prochaine » (lundi 6 h → lundi 6 h)', () => {
    const wed = new Date('2026-09-23T10:00:00Z');
    expect(windowFor('week', wed).start).toEqual(wed);
    expect(windowFor('week', wed).end.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    const next = windowFor('nextweek', wed);
    expect(next.start.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    expect(next.end.toISOString()).toBe('2026-10-05T04:00:00.000Z');
    // Dimanche soir : la semaine prochaine commence demain matin.
    const sun = new Date('2026-09-27T18:00:00Z');
    expect(windowFor('nextweek', sun).start.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    // Lundi matin : la semaine en cours va jusqu'au lundi suivant.
    const mon = new Date('2026-09-28T08:00:00Z');
    expect(windowFor('week', mon).end.toISOString()).toBe('2026-10-05T04:00:00.000Z');
  });

  it('garde les événements qui chevauchent la fenêtre', () => {
    const w = windowFor('today', SAT_20H);
    const e = fromPartnerEvent(event(), GRAND_PLACE, w, SAT_20H);
    expect(e?.timeLabel).toBe('21:00 – 23:30');
    expect(e?.distanceMeters).toBeGreaterThan(500);
    expect(fromPartnerEvent(event({ start: '2026-09-29T21:00:00+02:00', end: undefined }), GRAND_PLACE, w, SAT_20H)).toBeNull();
    const ongoing = fromPartnerEvent(event({ start: '2026-09-27T19:00:00+02:00' }), GRAND_PLACE, w, SAT_20H);
    expect(ongoing?.timeLabel).toBe('En cours · jusqu’à 23:30');
  });

  it('met « À la une » en premier', () => {
    const w = windowFor('today', SAT_20H);
    const a = fromPartnerEvent(event({ id: 'a' }), GRAND_PLACE, w, SAT_20H)!;
    const b = fromPartnerEvent(event({ id: 'b', featured: true, start: '2026-09-27T22:00:00+02:00' }), GRAND_PLACE, w, SAT_20H)!;
    expect(sortEvents([a, b]).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('lit un événement OpenAgenda', () => {
    const w = windowFor('today', SAT_20H);
    const e = fromOpenAgenda(
      {
        uid: 42,
        slug: 'jazz-au-vieux-lille',
        title: { fr: 'Jazz au Vieux-Lille' },
        description: { fr: 'Quartet en live' },
        timings: [
          { begin: '2026-09-20T20:00:00+02:00', end: '2026-09-20T22:00:00+02:00' },
          { begin: '2026-09-27T20:30:00+02:00', end: '2026-09-27T22:30:00+02:00' },
        ],
        location: { name: 'La Péniche', address: 'Quai du Wault', latitude: 50.6391, longitude: 3.0521 },
        image: { base: 'https://cdn.example/', filename: 'jazz.jpg' },
      },
      'agenda-lille',
      GRAND_PLACE,
      w,
      SAT_20H,
      'agenda-lille-slug',
    );
    expect(e).toMatchObject({
      title: 'Jazz au Vieux-Lille',
      category: 'concert',
      venueName: 'La Péniche',
      timeLabel: '20:30 – 22:30',
      imageUrl: 'https://cdn.example/jazz.jpg',
      url: 'https://openagenda.com/fr/agenda-lille-slug/events/jazz-au-vieux-lille',
      genres: ['jazz'],
      ongoing: false,
      dateLabel: 'dimanche 27 septembre · 20:30 – 22:30',
      source: 'openagenda',
    });
    expect(fromOpenAgenda({ title: 'Sans lieu' }, 'x', GRAND_PLACE, w)).toBeNull();
    expect(guessCategory('Braderie de Lille')).toBe('marche');
    expect(guessCategory('Pièce de théâtre')).toBe('spectacle');
  });

  it('classe les événements sans se laisser piéger par des bouts de mots', async () => {
    const { categorize, detectGenres, isFree, plainText } = await import('@/server/eventText');
    expect(categorize('Collection photographique Pecqueur')).toBe('expo'); // « rap » dans « photographique »
    expect(categorize('Exposition - République de Bérangère Fromont', 'Théâtre du Nord')).toBe('expo');
    expect(categorize('Concert de Lomepal')).toBe('concert');
    expect(categorize('Soirée disco au Magazine Club')).toBe('soiree');
    expect(categorize('Braderie de Lille')).toBe('marche');
    expect(categorize('Rencontre', 'Projection du film suivie d’un débat')).toBe('spectacle');
    expect(detectGenres('Concert jazz manouche')).toEqual(['jazz']);
    expect(detectGenres('Soirée techno et house')).toEqual(['electro']);
    expect(detectGenres('Récital de piano')).toEqual(['classique']);
    expect(detectGenres('Collection photographique')).toEqual([]);
    expect(isFree('Entrée libre')).toBe(true);
    expect(isFree('12 € / 8 € réduit')).toBe(false);
    expect(plainText('**Trio** de [jazz](https://x.fr)<br>Entrée libre')).toBe('Trio de jazz\nEntrée libre');
  });

  it('n’affiche « En cours » que si c’est commencé maintenant', () => {
    // Lundi 28/09 : « ce week-end » = vendredi 2/10 18 h → lundi 5/10 6 h.
    const monday = new Date('2026-09-28T11:00:00Z');
    const w = windowFor('weekend', monday);
    const expo = fromPartnerEvent(
      event({ category: 'expo', start: '2026-10-02T14:00:00+02:00', end: '2026-10-02T22:30:00+02:00' }),
      GRAND_PLACE,
      w,
      monday,
    )!;
    expect(expo.ongoing).toBe(false);
    expect(expo.timeLabel).toBe('ven. 14:00 – 22:30');
    expect(expo.dateLabel).toBe('vendredi 2 octobre · 14:00 – 22:30');
  });

  it('ne garde que les sorties culturelles pour touristes et jeunes', () => {
    const ev = (title: string, extra: object = {}) => ({ title: { fr: title }, ...extra });
    expect(isCulturalHighlight(ev('Concert de jazz au Grand Sud'))).toBe(true);
    expect(isCulturalHighlight(ev('Exposition « Lille la nuit » au Palais des Beaux-Arts'))).toBe(true);
    expect(isCulturalHighlight(ev('Braderie de Lille'))).toBe(true);
    expect(isCulturalHighlight(ev('Conseil municipal'))).toBe(false);
    expect(isCulturalHighlight(ev('Conseil de quartier de Wazemmes'))).toBe(false);
    expect(isCulturalHighlight(ev('Éveil musical pour les bébés'))).toBe(false);
    expect(isCulturalHighlight(ev('Spectacle de marionnettes', { age: { min: 3, max: 6 } }))).toBe(false);
    expect(isCulturalHighlight(ev('Thé dansant', { age: { min: 65, max: null } }))).toBe(false);
    expect(isCulturalHighlight(ev('Concert annulé', { status: 6 }))).toBe(false);
    expect(isCulturalHighlight(ev('Permanence des élus'))).toBe(false);
    expect(isCulturalHighlight(ev('Collecte de sang'))).toBe(false);
  });

  it('utilise l’agenda de la Ville de Lille par défaut', () => {
    vi.stubEnv('OPENAGENDA_KEY', 'cle');
    vi.stubEnv('OPENAGENDA_AGENDAS', '');
    expect(openAgendaConfig()).toBeNull(); // liste vide explicite : désactivé
    vi.unstubAllEnvs();
    vi.stubEnv('OPENAGENDA_KEY', 'cle');
    delete process.env.OPENAGENDA_AGENDAS;
    expect(openAgendaConfig()).toEqual({ key: 'cle', agendas: ['57621068'] });
    vi.unstubAllEnvs();
  });

  describe('avec OpenAgenda et un événement partenaire', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubEnv('OPENAGENDA_KEY', 'cle-test');
      vi.stubEnv('OPENAGENDA_AGENDAS', 'agenda-lille');
      vi.doMock('@/server/events.json', () => ({ default: [event({ featured: true })] }));
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          expect(url).toContain('/agendas/agenda-lille/events?key=cle-test');
          return new Response(
            JSON.stringify({
              events: [
                {
                  uid: 1,
                  title: { fr: 'Concert à l’Aéronef' }, // doublon du partenaire
                  timings: [{ begin: '2026-09-27T21:00:00+02:00' }],
                  location: { name: 'L’Aéronef', latitude: 50.6377, longitude: 3.0755 },
                },
                {
                  uid: 2,
                  title: 'Expo photo',
                  timings: [{ begin: '2026-09-27T18:00:00+02:00', end: '2026-09-27T23:00:00+02:00' }],
                  location: { name: 'Gare Saint-Sauveur', latitude: 50.6297, longitude: 3.0703 },
                },
              ],
            }),
          );
        }),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.doUnmock('@/server/events.json');
    });

    it('fusionne, dédoublonne et met le partenaire à la une', async () => {
      const { agenda } = await import('@/server/agenda');
      const events = await agenda(GRAND_PLACE, 'today', SAT_20H);
      expect(events.map((e) => [e.title, e.source])).toEqual([
        ['Concert à l’Aéronef', 'partner'],
        ['Expo photo', 'openagenda'],
      ]);
    });
  });
});

describe('I : espace partenaires', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('les fichiers d’exemple sont valides', async () => {
    const offers = (await import('@/server/offers.example.json')).default;
    const events = (await import('@/server/events.example.json')).default;
    expect(validItems('offers', offers)).toHaveLength(offers.length);
    expect(validItems('events', events)).toHaveLength(events.length);
  });

  it('valide chaque élément séparément', () => {
    const items = validItems('offers', [offer(), { id: 'cassé' }]);
    expect(items.map((o) => o.id)).toEqual(['happy-hour']);
  });

  it('compare les mots de passe en temps constant', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('ferme l’espace sans mot de passe et refuse un mauvais mot de passe', async () => {
    const { GET } = await import('@/app/api/admin/content+api');
    const req = (pwd?: string) =>
      new Request('http://x/api/admin/content?kind=offers', {
        headers: pwd ? { Authorization: `Bearer ${pwd}` } : {},
      });
    expect((await GET(req('peu-importe'))).status).toBe(503);
    vi.stubEnv('ADMIN_PASSWORD', 'un-mot-de-passe-solide');
    expect((await GET(req('mauvais'))).status).toBe(401);
    const ok = await GET(req('un-mot-de-passe-solide'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ items: [], database: false });
  });

  it('enregistre dans Supabase après validation', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'un-mot-de-passe-solide');
    vi.stubEnv('SUPABASE_URL', 'https://projet.supabase.co/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/admin/content+api');
    const post = (body: unknown) =>
      POST(
        new Request('http://x/api/admin/content?kind=offers', {
          method: 'POST',
          headers: { Authorization: 'Bearer un-mot-de-passe-solide' },
          body: JSON.stringify(body),
        }),
      );

    const bad = await post({ ...offer(), startDate: '27/09/2026' });
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).toContain('startDate');
    expect(fetchMock).not.toHaveBeenCalled();

    expect((await post(offer())).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projet.supabase.co/rest/v1/content?on_conflict=kind,id');
    expect((init.headers as Record<string, string>).apikey).toBe('service-key');
    const rows = JSON.parse(init.body as string);
    expect(rows[0]).toMatchObject({ kind: 'offers', id: 'happy-hour', data: { title: offer().title } });
  });

  it('lit les contenus et compte les clics depuis Supabase', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://projet.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/content?')
          ? new Response(JSON.stringify([{ data: offer() }, { data: { id: 'invalide' } }]))
          : new Response(
              JSON.stringify([
                { partner: 'vtc', place_id: 'A' },
                { partner: 'vtc', place_id: 'A' },
                { partner: 'resa', place_id: 'B' },
              ]),
            ),
      ),
    );
    const { getContent, clickStats } = await import('@/server/content');
    expect((await getContent('offers')).map((o) => o.id)).toEqual(['happy-hour']);
    expect(await clickStats(30)).toEqual([
      { partner: 'vtc', placeId: 'A', clicks: 2 },
      { partner: 'resa', placeId: 'B', clicks: 1 },
    ]);
  });

  it('convertit les formulaires dans les deux sens', () => {
    const fields = KINDS.offers.fields;
    const values = {
      ...emptyValues(fields),
      id: 'happy-hour',
      title: '2 bières pour le prix d’1',
      placeId: 'ChIJ_illustration_01',
      placeName: 'L’Illustration',
      'location.lat': '50,6395',
      'location.lng': '3.0585',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      days: '5,6',
    };
    const { item } = toItem(fields, values);
    expect(item).toEqual({
      id: 'happy-hour',
      title: '2 bières pour le prix d’1',
      placeId: 'ChIJ_illustration_01',
      placeName: 'L’Illustration',
      location: { lat: 50.6395, lng: 3.0585 },
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      days: [5, 6],
      active: true,
    });
    expect(validItems('offers', [item])).toHaveLength(1);
    expect(toValues(fields, item!)).toMatchObject({ 'location.lat': '50.6395', days: '5,6' });
    expect(toItem(fields, { ...values, title: '' }).error).toContain('Offre');

    const ev = toItem(KINDS.events.fields, {
      ...emptyValues(KINDS.events.fields),
      id: 'soiree',
      title: 'Soirée',
      venueName: 'Bar',
      'location.lat': '50.63',
      'location.lng': '3.06',
      start: '2026-10-03 21:00',
    });
    expect(validItems('events', [ev.item])).toHaveLength(1);
    expect(toValues(KINDS.events.fields, ev.item!).start).toBe('2026-10-03 21:00');
  });
});

describe('Ticketmaster', () => {
  const labels = () => ({ timeLabel: '20:00', dateLabel: 'samedi', ongoing: false });
  const base = {
    id: 'Z1',
    name: 'Angèle',
    url: 'https://www.ticketmaster.fr/x',
    dates: { start: { dateTime: '2026-10-10T18:00:00Z' }, status: { code: 'onsale' } },
    images: [
      { url: 'https://img/a.jpg', width: 305, ratio: '16_9' },
      { url: 'https://img/b.jpg', width: 640, ratio: '16_9' },
      { url: 'https://img/c.jpg', width: 1024, ratio: '16_9' },
    ],
    classifications: [{ segment: { name: 'Music' }, genre: { name: 'Pop' } }],
    priceRanges: [{ min: 39, max: 59.5, currency: 'EUR' }],
    _embedded: {
      venues: [{ name: 'Zénith de Lille', city: { name: 'Lille' }, location: { latitude: '50.6327', longitude: '3.0784' } }],
    },
  };

  it('convertit un concert : salle, image 16:9, prix, billetterie', async () => {
    const { fromTicketmaster } = await import('@/server/ticketmaster');
    const e = fromTicketmaster(base, GRAND_PLACE, labels);
    expect(e?.id).toBe('tm-Z1');
    expect(e?.category).toBe('concert');
    expect(e?.venueName).toBe('Zénith de Lille');
    expect(e?.imageUrl).toBe('https://img/c.jpg');
    expect(e?.price).toBe('de 39 € à 59,50 €');
    expect(e?.ticketUrl).toBe('https://www.ticketmaster.fr/x');
    expect(e?.source).toBe('ticketmaster');
  });

  it('ignore les photos génériques de Ticketmaster et prend celle de l’artiste', async () => {
    const { bestImage, fromTicketmaster } = await import('@/server/ticketmaster');
    const generic = [{ url: 'https://img/eiffel.jpg', width: 1024, ratio: '16_9', fallback: true }];
    const artist = [{ url: 'https://img/linh.jpg', width: 1136, ratio: '16_9', fallback: false }];
    expect(bestImage(generic, artist)).toBe('https://img/linh.jpg');
    expect(bestImage(generic)).toBeUndefined();
    const e = fromTicketmaster(
      {
        ...base,
        images: generic,
        pleaseNote: 'Ouverture des portes à 19h.',
        ageRestrictions: { legalAgeEnforced: true },
        _embedded: {
          ...base._embedded,
          attractions: [{ name: 'LINH', images: artist, externalLinks: { spotify: [{ url: 'https://open.spotify.com/x' }] } }],
        },
      },
      GRAND_PLACE,
      labels,
    );
    expect(e?.imageUrl).toBe('https://img/linh.jpg');
    expect(e?.practical?.notes).toEqual(['Ouverture des portes à 19h.']);
    expect(e?.practical?.ageMin).toBe(18);
    expect(e?.practical?.links).toEqual([{ kind: 'spotify', url: 'https://open.spotify.com/x' }]);
  });

  it('écarte les événements annulés ou sans salle', async () => {
    const { fromTicketmaster } = await import('@/server/ticketmaster');
    expect(fromTicketmaster({ ...base, dates: { ...base.dates, status: { code: 'cancelled' } } }, GRAND_PLACE, labels)).toBeNull();
    expect(fromTicketmaster({ ...base, _embedded: {} }, GRAND_PLACE, labels)).toBeNull();
  });
});

describe('agenda : doublons entre sources', () => {
  const ev = (over: Partial<AgendaEvent>): AgendaEvent => ({
    id: 'x',
    title: 'concert : Youngblood Brass band',
    category: 'concert',
    venueName: 'FLOW',
    location: { lat: 50.622521, lng: 3.067621 },
    start: '2026-10-06T18:00:00.000Z',
    timeLabel: '20:00',
    dateLabel: 'mardi',
    ongoing: false,
    featured: false,
    source: 'openagenda',
    distanceMeters: 0,
    ...over,
  });

  it('reconnaît le même concert sur OpenAgenda et Ticketmaster', async () => {
    const { sameEvent } = await import('@/server/agenda');
    const tm = ev({ id: 'tm', title: 'YOUNGBLOOD BRASS BAND', venueName: 'LE FLOW', location: { lat: 50.622411, lng: 3.067468 }, source: 'ticketmaster' });
    expect(sameEvent(ev({}), tm)).toBe(true);
    expect(sameEvent(ev({}), { ...tm, start: '2026-10-07T18:00:00.000Z' })).toBe(false);
    expect(sameEvent(ev({}), { ...tm, title: 'Autre groupe' })).toBe(false);
  });

  it('reconnaît une même soirée publiée sous deux titres', async () => {
    const { sameEvent } = await import('@/server/agenda');
    const long = 'Tous les jeudis au Bistrot de St So ! Du bon goût pour tes oreilles, du bon son pour ton bidon. DJ Vadim en tête d’affiche.';
    const a = ev({ title: 'DJ Vadim + Selecta Cab', longDescription: long });
    const b = ev({ id: 'y', title: 'Shii Foo Miix', description: 'DJ Vadim + Selecta Cab' });
    expect(sameEvent(a, b)).toBe(true);
    expect(sameEvent(ev({ title: 'Soirée A', longDescription: long }), ev({ title: 'Soirée B', longDescription: long }))).toBe(true);
    // Deux concerts différents au même endroit, même heure : gardés tous les deux.
    expect(sameEvent(ev({ title: 'Groupe A', description: 'Rock' }), ev({ title: 'Groupe B', description: 'Jazz' }))).toBe(false);
  });
});

describe('OpenAgenda : infos pratiques', () => {
  it('prochaines dates, âge, accessibilité, accès, contacts, statut', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const shown = new Date('2026-10-06T18:00:00Z');
    const p = openAgendaPractical(
      {
        timings: [
          { begin: '2026-10-01T18:00:00Z' },
          { begin: '2026-10-06T18:00:00Z' },
          { begin: '2026-10-13T18:00:00Z' },
        ],
        age: { min: 12, max: null },
        accessibility: { mi: true, hi: true, vi: false },
        location: { access: { fr: 'Métro ligne 1, station Rihour' }, website: 'https://salle.fr', phone: '03 20 00 00 00' },
        registration: [{ type: 'email', value: 'resa@salle.fr' }],
        status: 5,
      },
      shown,
      now,
      '10 € / 5 € réduit, gratuit pour les moins de 12 ans',
    );
    expect(p?.nextDates).toEqual(['2026-10-13T18:00:00.000Z']);
    expect(p?.ageMin).toBe(12);
    expect(p?.accessibility).toEqual(['pmr', 'auditif']);
    expect(p?.access).toBe('Métro ligne 1, station Rihour');
    expect(p?.phone).toBe('03 20 00 00 00');
    expect(p?.email).toBe('resa@salle.fr');
    expect(p?.website).toBe('https://salle.fr');
    expect(p?.status).toBe('complet');
    expect(p?.priceDetail).toContain('réduit');
  });
});
