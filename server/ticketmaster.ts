// Concerts, spectacles et matchs autour de Lille via l'API Discovery de Ticketmaster
// (clé gratuite : TICKETMASTER_API_KEY, la « Consumer Key » ; le secret est inutile).

import { haversineMeters } from '@/shared/geo';
import { type Lang, translate } from '@/shared/i18n';
import type { AgendaEvent, EventCategory, EventPractical, LatLng } from '@/shared/types';

import { TtlCache } from './cache';
import { detectGenres, plainText } from './eventText';

export const TICKETMASTER_URL = process.env.TICKETMASTER_URL ?? 'https://app.ticketmaster.com/discovery/v2';
// Grande place de Lille : une seule requête partagée par tous les utilisateurs.
const LILLE = { lat: 50.6366, lng: 3.0635 };
const RADIUS_KM = 20;

type TmImage = { url?: string; width?: number; height?: number; ratio?: string; fallback?: boolean };
type TmLinks = Partial<Record<'homepage' | 'spotify' | 'youtube' | 'instagram' | 'facebook' | 'deezer', { url?: string }[]>>;

export interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  description?: string;
  info?: string;
  pleaseNote?: string;
  accessibility?: { info?: string };
  ageRestrictions?: { legalAgeEnforced?: boolean };
  promoter?: { name?: string };
  seatmap?: { staticUrl?: string };
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string };
    status?: { code?: string };
  };
  images?: TmImage[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  _embedded?: {
    venues?: {
      name?: string;
      url?: string;
      address?: { line1?: string };
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
      parkingDetail?: string;
      accessibleSeatingDetail?: string;
      boxOfficeInfo?: { phoneNumberDetail?: string; openHoursDetail?: string };
      generalInfo?: { generalRule?: string; childRule?: string };
    }[];
    attractions?: { name?: string; images?: TmImage[]; externalLinks?: TmLinks }[];
  };
}

export function ticketmasterKey(): string | null {
  return process.env.TICKETMASTER_API_KEY?.trim() || null;
}

/** « 2026-10-05T18:00:00Z » : Ticketmaster refuse les millisecondes. */
const tmDate = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

const cache = new TtlCache<TmEvent[]>(30 * 60_000, 30);

/** Événements Ticketmaster de la fenêtre (jusqu'à 200), en cache 30 min. */
export async function fetchTicketmaster(key: string, w: { start: Date; end: Date }): Promise<TmEvent[]> {
  // À l'heure près : la fenêtre « aujourd'hui » commence à « maintenant ».
  const cacheKey = `${tmDate(w.start).slice(0, 13)}|${tmDate(w.end).slice(0, 13)}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const events: TmEvent[] = [];
  for (let page = 0; page < 2; page++) {
    const q = new URLSearchParams({
      apikey: key,
      latlong: `${LILLE.lat},${LILLE.lng}`,
      radius: String(RADIUS_KM),
      unit: 'km',
      startDateTime: tmDate(w.start),
      endDateTime: tmDate(w.end),
      size: '100',
      page: String(page),
      sort: 'date,asc',
      locale: '*',
    });
    const res = await fetch(`${TICKETMASTER_URL}/events.json?${q}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
    const body = (await res.json()) as {
      _embedded?: { events?: TmEvent[] };
      page?: { totalPages?: number };
    };
    events.push(...(body._embedded?.events ?? []));
    if ((body.page?.totalPages ?? 1) <= page + 1) break;
  }
  cache.set(cacheKey, events);
  return events;
}

function category(ev: TmEvent): EventCategory {
  const c = ev.classifications?.[0];
  const segment = c?.segment?.name?.toLowerCase() ?? '';
  const genre = c?.genre?.name?.toLowerCase() ?? '';
  if (segment === 'music') return 'concert';
  if (segment === 'sports') return 'sport';
  if (segment.startsWith('arts')) return /fine art|exhibit|expo/.test(genre) ? 'expo' : 'spectacle';
  return 'autre';
}

/** Image la plus adaptée aux cartes : format 16:9, la plus petite au-delà de 600 px. */
export function bestImage(images: TmImage[] | undefined): string | undefined {
  const usable = (images ?? []).filter((i) => i.url?.startsWith('https://'));
  const wide = usable.filter((i) => i.ratio === '16_9').sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide.find((i) => (i.width ?? 0) >= 600) ?? wide.at(-1) ?? usable[0])?.url;
}

const clean = (s: string | undefined) => plainText(s)?.trim() || undefined;

function practicalInfo(ev: TmEvent): EventPractical | undefined {
  const venue = ev._embedded?.venues?.[0];
  const artist = ev._embedded?.attractions?.[0];
  const notes = [
    clean(ev.pleaseNote),
    clean(venue?.generalInfo?.generalRule),
    clean(venue?.generalInfo?.childRule),
    clean(venue?.boxOfficeInfo?.openHoursDetail),
    ev.accessibility?.info ? clean(ev.accessibility.info) : clean(venue?.accessibleSeatingDetail),
  ].filter((n): n is string => !!n);
  const LINKS: [keyof TmLinks, NonNullable<EventPractical['links']>[number]['kind']][] = [
    ['homepage', 'site'],
    ['spotify', 'spotify'],
    ['youtube', 'youtube'],
    ['instagram', 'instagram'],
    ['facebook', 'facebook'],
    ['deezer', 'deezer'],
  ];
  const links = LINKS.flatMap(([key, kind]) => {
    const url = artist?.externalLinks?.[key]?.[0]?.url;
    return url?.startsWith('https://') ? [{ kind, url }] : [];
  });
  const phone = clean(venue?.boxOfficeInfo?.phoneNumberDetail);
  const practical: EventPractical = {
    ...(ev.ageRestrictions?.legalAgeEnforced ? { ageMin: 18 } : {}),
    ...(clean(venue?.parkingDetail) ? { access: clean(venue?.parkingDetail) } : {}),
    ...(phone && phone.length < 60 ? { phone } : {}),
    ...(notes.length ? { notes: [...new Set(notes)] } : {}),
    ...(ev.promoter?.name ? { organizer: ev.promoter.name } : {}),
    ...(ev.seatmap?.staticUrl?.startsWith('https://') ? { seatmapUrl: ev.seatmap.staticUrl } : {}),
    ...(links.length ? { links } : {}),
    ...(ev.dates?.status?.code === 'rescheduled' ? { status: 'reprogramme' as const } : {}),
  };
  return Object.keys(practical).length ? practical : undefined;
}

function price(ev: TmEvent, lang: Lang): string | undefined {
  const p = ev.priceRanges?.[0];
  if (typeof p?.min !== 'number') return undefined;
  const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} ${p.currency === 'EUR' || !p.currency ? '€' : p.currency}`;
  return p.max && p.max !== p.min
    ? translate(lang, 'de {min} à {max}', { min: fmt(p.min), max: fmt(p.max) })
    : fmt(p.min);
}

/**
 * Événement Ticketmaster → événement de l'agenda. Les libellés d'horaire viennent
 * de l'agenda (mêmes fonctions que pour OpenAgenda), passés par `labels`.
 */
export function fromTicketmaster(
  ev: TmEvent,
  near: LatLng,
  labels: (start: Date, end: Date | undefined) => { timeLabel: string; dateLabel: string; ongoing: boolean },
  lang: Lang = 'fr',
): AgendaEvent | null {
  const title = ev.name?.trim();
  const status = ev.dates?.status?.code;
  if (!title || status === 'cancelled' || status === 'postponed') return null;
  const venue = ev._embedded?.venues?.[0];
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  const startIso = ev.dates?.start?.dateTime;
  if (!venue || !Number.isFinite(lat) || !Number.isFinite(lng) || !startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = ev.dates?.end?.dateTime ? new Date(ev.dates.end.dateTime) : undefined;

  const location = { lat, lng };
  const c = ev.classifications?.[0];
  const cat = category(ev);
  const longDescription = clean(ev.description ?? ev.info);
  const description = longDescription?.slice(0, 300);
  const practical = practicalInfo(ev);
  const priceText = price(ev, lang);
  const genres =
    cat === 'concert' ? detectGenres(title, c?.genre?.name, c?.subGenre?.name, description) : [];
  const address = [venue.address?.line1, venue.city?.name].filter(Boolean).join(', ');
  return {
    id: `tm-${ev.id}`,
    title,
    ...(description ? { description } : {}),
    category: cat,
    venueName: venue.name ?? translate(lang, 'Lieu à préciser'),
    location,
    ...(address ? { address } : {}),
    start: start.toISOString(),
    ...(end ? { end: end.toISOString() } : {}),
    ...labels(start, end),
    price: priceText,
    free: false,
    url: ev.url,
    ticketUrl: ev.url,
    imageUrl: bestImage(ev.images),
    ...(longDescription && longDescription !== description ? { longDescription } : {}),
    ...(practical ? { practical } : {}),
    featured: false,
    source: 'ticketmaster',
    distanceMeters: Math.round(haversineMeters(near, location)),
    ...(genres.length ? { genres } : {}),
  };
}
