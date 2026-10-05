// Concerts, spectacles et matchs autour de Lille via l'API Discovery de Ticketmaster
// (clé gratuite : TICKETMASTER_API_KEY, la « Consumer Key » ; le secret est inutile).

import { haversineMeters } from '@/shared/geo';
import { type Lang, translate } from '@/shared/i18n';
import type { AgendaEvent, EventCategory, LatLng } from '@/shared/types';

import { TtlCache } from './cache';
import { detectGenres, plainText } from './eventText';

export const TICKETMASTER_URL = process.env.TICKETMASTER_URL ?? 'https://app.ticketmaster.com/discovery/v2';
// Grande place de Lille : une seule requête partagée par tous les utilisateurs.
const LILLE = { lat: 50.6366, lng: 3.0635 };
const RADIUS_KM = 20;

export interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string };
    status?: { code?: string };
  };
  images?: { url?: string; width?: number; ratio?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
    }[];
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
function bestImage(images: TmEvent['images']): string | undefined {
  const usable = (images ?? []).filter((i) => i.url?.startsWith('https://'));
  const wide = usable.filter((i) => i.ratio === '16_9').sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide.find((i) => (i.width ?? 0) >= 600) ?? wide.at(-1) ?? usable[0])?.url;
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
  const description = plainText(ev.info ?? ev.pleaseNote)?.slice(0, 300);
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
    price: price(ev, lang),
    free: false,
    url: ev.url,
    ticketUrl: ev.url,
    imageUrl: bestImage(ev.images),
    featured: false,
    source: 'ticketmaster',
    distanceMeters: Math.round(haversineMeters(near, location)),
    ...(genres.length ? { genres } : {}),
  };
}
