// Agenda « Ce soir à Lille » :
// - événements saisis dans l'espace partenaires (dont les événements « À la une », payants) ;
// - événements publics d'OpenAgenda, si OPENAGENDA_KEY et OPENAGENDA_AGENDAS sont définies.

import { haversineMeters } from '@/shared/geo';
import type { AgendaEvent, AgendaWhen, EventCategory, LatLng } from '@/shared/types';

import { TtlCache } from './cache';
import { getContent } from './content';
import { addDays, formatParisDayTime, formatParisTime, parisParts, parisTime } from './paris';
import type { EventItem } from './schemas';

export const OPENAGENDA_URL = process.env.OPENAGENDA_URL ?? 'https://api.openagenda.com/v2';
const RADIUS_METERS = 15_000;
const DEFAULT_DURATION_MS = 3 * 3_600_000;

export interface TimeWindow {
  start: Date;
  end: Date;
}

/**
 * Fenêtres de l'agenda, heure de Lille. Une « journée » de sortie va de 6 h à 6 h :
 * à 1 h du matin, « ce soir » est encore la soirée en cours.
 */
export function windowFor(when: AgendaWhen, now: Date = new Date()): TimeWindow {
  const p = parisParts(now);
  const outingDay = p.minutes < 6 * 60 ? addDays(p.date, -1) : p.date;
  if (when === 'today') return { start: now, end: parisTime(addDays(outingDay, 1), 6) };
  if (when === 'tomorrow') {
    return { start: parisTime(addDays(outingDay, 1), 6), end: parisTime(addDays(outingDay, 2), 6) };
  }
  // Week-end : du vendredi 18 h au lundi 6 h (celui en cours, ou le prochain).
  const outingWeekday = p.minutes < 6 * 60 ? (p.day + 6) % 7 : p.day;
  const daysToFriday = outingWeekday === 0 ? -2 : outingWeekday === 6 ? -1 : 5 - outingWeekday;
  const friday = addDays(outingDay, daysToFriday);
  const start = parisTime(friday, 18);
  return { start: start > now ? start : now, end: parisTime(addDays(friday, 3), 6) };
}

function overlaps(start: Date, end: Date | undefined, w: TimeWindow): boolean {
  const e = end ?? new Date(start.getTime() + DEFAULT_DURATION_MS);
  return start < w.end && e > w.start;
}

export function timeLabel(start: Date, end: Date | undefined, w: TimeWindow): string {
  const sameOutingDay = w.end.getTime() - w.start.getTime() <= 30 * 3_600_000;
  const startLabel = sameOutingDay ? formatParisTime(start) : formatParisDayTime(start);
  if (start < w.start) return end ? `En cours · jusqu’à ${formatParisTime(end)}` : 'En cours';
  return end && end.getTime() - start.getTime() < 24 * 3_600_000
    ? `${startLabel} – ${formatParisTime(end)}`
    : startLabel;
}

export function fromPartnerEvent(item: EventItem, near: LatLng, w: TimeWindow): AgendaEvent | null {
  if (!item.active) return null;
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : undefined;
  if (!overlaps(start, end, w)) return null;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    venueName: item.venueName,
    placeId: item.placeId,
    location: item.location,
    address: item.address,
    start: item.start,
    end: item.end,
    timeLabel: timeLabel(start, end, w),
    price: item.price,
    url: item.url,
    imageUrl: item.imageUrl,
    featured: item.featured,
    source: 'partner',
    distanceMeters: Math.round(haversineMeters(near, item.location)),
  };
}

// --- OpenAgenda ---

type Multilingual = string | Record<string, string | undefined> | undefined;

function text_(value: Multilingual): string {
  return text(value) ?? '';
}

function text(value: Multilingual): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.fr ?? Object.values(value).find((v) => !!v);
}

interface OpenAgendaEvent {
  uid?: number | string;
  slug?: string;
  title?: Multilingual;
  description?: Multilingual;
  keywords?: Record<string, string[] | undefined> | string[];
  timings?: { begin?: string; end?: string }[];
  location?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  image?: { base?: string; filename?: string } | string | null;
  conditions?: Multilingual;
  longDescription?: Multilingual;
  age?: { min?: number | null; max?: number | null } | null;
  /** 6 = annulé (OpenAgenda). */
  status?: number;
}

/** Agenda de la Ville de Lille (https://openagenda.com/fr/ville-de-lille). */
export const VILLE_DE_LILLE_AGENDA = '57621068';

// Sorties culturelles qui intéressent touristes et jeunes Lillois…
const CULTURE =
  /concert|festival|expo(sition)?s?\b|spectacle|th[ée][âa]tre|danse|cin[ée]ma|projection|mus[ée]e|visite|patrimoine|op[ée]ra|orchestre|jazz|rock|[ée]lectro|hip[- ]?hop|rap\b|dj\b|live\b|soir[ée]e|f[êe]te|braderie|march[ée] de no[ëe]l|vernissage|street[- ]?art|performance|humour|stand[- ]?up|cirque|lille3000|nuit (blanche|des mus[ée]es)|guinguette|bal\b|slam|photo/i;
// … et pas la vie administrative ou les activités très ciblées.
const EXCLUDED =
  /conseil (municipal|de quartier|communal)|r[ée]union|permanence|b[ée]b[ée]s?\b|tout[- ]petits?|petite enfance|\b[0-6] ?(à|-) ?\d+ ?ans|seniors?\b|a[îi]n[ée]s|collecte|don du sang|vaccination|formation|inscriptions?\b|recrutement|emploi|cours (de|d')|stage\b|accueil de loisirs|centre social|[ée]lections?|enqu[êe]te publique|travaux|concertation|consultation|d[ée]m[ée]nagement|atelier (parents?|famille)|goûter|aide aux devoirs/i;

/** Événement culturel susceptible d'intéresser touristes et 16-35 ans. */
export function isCulturalHighlight(ev: OpenAgendaEvent): boolean {
  if (ev.status === 6) return false; // annulé
  const max = ev.age?.max;
  const min = ev.age?.min;
  if (typeof max === 'number' && max > 0 && max < 14) return false; // réservé aux enfants
  if (typeof min === 'number' && min >= 60) return false;
  const keywords = Array.isArray(ev.keywords) ? ev.keywords : (ev.keywords?.fr ?? []);
  const text = [text_(ev.title), text_(ev.description), keywords.join(' ')].join(' ');
  if (EXCLUDED.test(text)) return false;
  return CULTURE.test(text);
}

const CATEGORY_WORDS: [EventCategory, RegExp][] = [
  ['concert', /concert|musique|live|dj|jazz|rock|rap|électro|electro/i],
  ['soiree', /soir[ée]e|clubbing|f[êe]te|bal\b/i],
  ['expo', /expo|mus[ée]e|galerie|vernissage/i],
  ['spectacle', /spectacle|th[ée][âa]tre|danse|humour|cirque|cin[ée]ma|projection/i],
  ['marche', /march[ée]|brocante|braderie|vide-grenier/i],
  ['sport', /sport|match|course|foot|basket/i],
];

export function guessCategory(...texts: (string | undefined)[]): EventCategory {
  const all = texts.filter(Boolean).join(' ');
  return CATEGORY_WORDS.find(([, re]) => re.test(all))?.[0] ?? 'autre';
}

function imageUrl(image: OpenAgendaEvent['image']): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image.startsWith('https://') ? image : undefined;
  if (image.base && image.filename) return `${image.base}${image.filename}`;
  return undefined;
}

export function fromOpenAgenda(
  ev: OpenAgendaEvent,
  agendaUid: string,
  near: LatLng,
  w: TimeWindow,
): AgendaEvent | null {
  const title = text(ev.title);
  const loc = ev.location;
  if (!title || !loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
    return null;
  }
  // Un événement peut avoir plusieurs dates : on garde la première dans la fenêtre.
  const timing = (ev.timings ?? [])
    .map((t) => ({ start: t.begin ? new Date(t.begin) : null, end: t.end ? new Date(t.end) : undefined }))
    .filter((t): t is { start: Date; end: Date | undefined } => !!t.start && !Number.isNaN(t.start.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((t) => overlaps(t.start, t.end, w));
  if (!timing) return null;

  const location = { lat: loc.latitude, lng: loc.longitude };
  const keywords = Array.isArray(ev.keywords) ? ev.keywords : (ev.keywords?.fr ?? []);
  const description = text(ev.description);
  return {
    id: `oa-${agendaUid}-${ev.uid ?? ev.slug ?? title}`,
    title,
    description,
    category: guessCategory(title, description, keywords.join(' ')),
    venueName: loc.name ?? 'Lieu à préciser',
    location,
    address: loc.address,
    start: timing.start.toISOString(),
    end: timing.end?.toISOString(),
    timeLabel: timeLabel(timing.start, timing.end, w),
    price: text(ev.conditions)?.slice(0, 40),
    url: ev.slug ? `https://openagenda.com/agendas/${agendaUid}/events/${ev.slug}` : undefined,
    imageUrl: imageUrl(ev.image),
    featured: false,
    source: 'openagenda',
    distanceMeters: Math.round(haversineMeters(near, location)),
  };
}

const openAgendaCache = new TtlCache<OpenAgendaEvent[]>(15 * 60_000, 50);

async function fetchOpenAgenda(uid: string, key: string, w: TimeWindow): Promise<OpenAgendaEvent[]> {
  // Clé de cache à l'heure près : tous les utilisateurs partagent la même réponse.
  const hour = (d: Date) => d.toISOString().slice(0, 13);
  const cacheKey = `${uid}|${hour(w.start)}|${hour(w.end)}`;
  const hit = openAgendaCache.get(cacheKey);
  if (hit) return hit;

  const q = new URLSearchParams({
    key,
    size: '100',
    detailed: '1',
    'timings[gte]': w.start.toISOString(),
    'timings[lte]': w.end.toISOString(),
  });
  const res = await fetch(`${OPENAGENDA_URL}/agendas/${encodeURIComponent(uid)}/events?${q}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`OpenAgenda ${res.status}`);
  const events = ((await res.json()) as { events?: OpenAgendaEvent[] }).events ?? [];
  openAgendaCache.set(cacheKey, events);
  return events;
}

export function openAgendaConfig(): { key: string; agendas: string[] } | null {
  const key = process.env.OPENAGENDA_KEY;
  // Par défaut : l'agenda officiel de la Ville de Lille.
  const agendas = (process.env.OPENAGENDA_AGENDAS ?? VILLE_DE_LILLE_AGENDA)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return key && agendas.length ? { key, agendas } : null;
}

/** À la une d'abord, puis par heure de début, puis par distance. */
export function sortEvents(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      a.start.localeCompare(b.start) ||
      a.distanceMeters - b.distanceMeters,
  );
}

export async function agenda(
  near: LatLng,
  when: AgendaWhen,
  now: Date = new Date(),
): Promise<AgendaEvent[]> {
  const w = windowFor(when, now);
  const partner = (await getContent('events'))
    .map((item) => fromPartnerEvent(item, near, w))
    .filter((e): e is AgendaEvent => e !== null);

  const oa = openAgendaConfig();
  const external = oa
    ? (
        await Promise.all(
          oa.agendas.map((uid) =>
            fetchOpenAgenda(uid, oa.key, w)
              .then((events) =>
                events.filter(isCulturalHighlight).map((ev) => fromOpenAgenda(ev, uid, near, w)),
              )
              .catch((error: unknown) => {
                console.error('[agenda] OpenAgenda indisponible', uid, error);
                return [];
              }),
          ),
        )
      ).flat()
    : [];

  // Même titre au même endroit (partenaire + OpenAgenda) : on garde la version partenaire.
  const seen = new Set(partner.map((e) => `${e.title.toLowerCase()}|${e.venueName.toLowerCase()}`));
  const merged = [
    ...partner,
    ...external.filter(
      (e): e is AgendaEvent =>
        e !== null && !seen.has(`${e.title.toLowerCase()}|${e.venueName.toLowerCase()}`),
    ),
  ];
  return sortEvents(merged.filter((e) => e.distanceMeters <= RADIUS_METERS)).slice(0, 60);
}
