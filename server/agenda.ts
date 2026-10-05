// Agenda des sorties (aujourd'hui, demain, la semaine, le week-end…) :
// - événements saisis dans l'espace partenaires (dont les événements « À la une », payants) ;
// - événements publics d'OpenAgenda, si OPENAGENDA_KEY et OPENAGENDA_AGENDAS sont définies.

import { haversineMeters } from '@/shared/geo';
import { type Lang, LANG_INFO, translate } from '@/shared/i18n';
import type { AgendaEvent, AgendaWhen, LatLng } from '@/shared/types';

import { isAutoTranslateEnabled, lastTranslateError, translateFields } from './autoTranslate';

import { TtlCache } from './cache';
import { getContent } from './content';
import { categorize, detectGenres, isFree, plainText } from './eventText';
import { mainPhotoName } from './places';
import { fetchTicketmaster, fromTicketmaster, ticketmasterKey } from './ticketmaster';
import { addDays, formatParisDayTime, formatParisTime, parisParts, parisTime } from './paris';
import type { EventItem } from './schemas';

export const OPENAGENDA_URL = process.env.OPENAGENDA_URL ?? 'https://api.openagenda.com/v2';
const RADIUS_METERS = 15_000;
const MAX_EVENTS = 250;
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
  const outingWeekday = p.minutes < 6 * 60 ? (p.day + 6) % 7 : p.day;
  // Semaine : jusqu'au lundi 6 h qui suit ; semaine prochaine : le lundi suivant, 6 h → 6 h.
  const nextMonday = addDays(outingDay, (8 - outingWeekday) % 7 || 7);
  if (when === 'week') return { start: now, end: parisTime(nextMonday, 6) };
  if (when === 'nextweek') return { start: parisTime(nextMonday, 6), end: parisTime(addDays(nextMonday, 7), 6) };
  // Week-end : du vendredi 18 h au lundi 6 h (celui en cours, ou le prochain).
  const daysToFriday = outingWeekday === 0 ? -2 : outingWeekday === 6 ? -1 : 5 - outingWeekday;
  const friday = addDays(outingDay, daysToFriday);
  const start = parisTime(friday, 18);
  return { start: start > now ? start : now, end: parisTime(addDays(friday, 3), 6) };
}

function overlaps(start: Date, end: Date | undefined, w: TimeWindow): boolean {
  const e = end ?? new Date(start.getTime() + DEFAULT_DURATION_MS);
  return start < w.end && e > w.start;
}

/**
 * Horaire court. « En cours » seulement si c'est commencé MAINTENANT (et pas juste
 * avant le début de la fenêtre, ex. vendredi après-midi pour « ce week-end »).
 */
export function timeLabel(
  start: Date,
  end: Date | undefined,
  w: TimeWindow,
  now: Date = new Date(),
  lang: Lang = 'fr',
): string {
  if (start <= now) {
    return end
      ? translate(lang, 'En cours · jusqu’à {time}', { time: formatParisTime(end) })
      : translate(lang, 'En cours');
  }
  const sameOutingDay = w.end.getTime() - w.start.getTime() <= 30 * 3_600_000;
  const startLabel = sameOutingDay ? formatParisTime(start) : formatParisDayTime(start, lang);
  return end && end.getTime() - start.getTime() < 24 * 3_600_000
    ? `${startLabel} – ${formatParisTime(end)}`
    : startLabel;
}

const longDateFmts = new Map<Lang, Intl.DateTimeFormat>();
function longDateFmt(lang: Lang): Intl.DateTimeFormat {
  let f = longDateFmts.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(LANG_INFO[lang].locale, {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    longDateFmts.set(lang, f);
  }
  return f;
}

/** « samedi 3 octobre · 21:00 – 23:30 ». */
export function dateLabel(start: Date, end?: Date, lang: Lang = 'fr'): string {
  const day = longDateFmt(lang).format(start);
  if (!end) return `${day} · ${formatParisTime(start)}`;
  if (end.getTime() - start.getTime() < 24 * 3_600_000) {
    return `${day} · ${formatParisTime(start)} – ${formatParisTime(end)}`;
  }
  return translate(lang, 'du {start} au {end}', { start: day, end: longDateFmt(lang).format(end) });
}

export function fromPartnerEvent(
  item: EventItem,
  near: LatLng,
  w: TimeWindow,
  now: Date = new Date(),
  lang: Lang = 'fr',
): AgendaEvent | null {
  if (!item.active) return null;
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : undefined;
  if (!overlaps(start, end, w)) return null;
  const genres = detectGenres(item.title, item.description);
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
    timeLabel: timeLabel(start, end, w, now, lang),
    dateLabel: dateLabel(start, end, lang),
    ongoing: start <= now,
    price: item.price,
    free: isFree(item.price),
    url: item.url,
    ticketUrl: item.url,
    imageUrl: item.imageUrl,
    featured: item.featured,
    source: 'partner',
    distanceMeters: Math.round(haversineMeters(near, item.location)),
    ...(genres.length ? { genres } : {}),
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

/** Texte déjà rédigé dans `lang` par l'organisateur (OpenAgenda est multilingue), sinon rien. */
function nativeText(value: Multilingual, lang: Lang): string | undefined {
  if (lang === 'fr' || !value || typeof value === 'string') return undefined;
  return value[lang] || undefined;
}

// Événements dont les textes sont déjà dans la bonne langue (pas besoin de les traduire).
const natives = new WeakSet<AgendaEvent>();

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
  registration?: { type?: string; value?: string }[];
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

/** Conservé pour compatibilité : catégorie d'après les textes (titre en premier). */
export function guessCategory(title: string, ...rest: (string | undefined)[]) {
  return categorize(title, ...rest);
}

function imageUrl(image: OpenAgendaEvent['image']): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image.startsWith('https://') ? image : undefined;
  if (image.base && image.filename) return `${image.base}${image.filename}`;
  return undefined;
}

/** Adresse publique d'un événement sur openagenda.com. */
export function openAgendaEventUrl(agendaSlug: string | undefined, eventSlug: string | undefined) {
  return agendaSlug && eventSlug
    ? `https://openagenda.com/fr/${agendaSlug}/events/${eventSlug}`
    : undefined;
}

export function fromOpenAgenda(
  ev: OpenAgendaEvent,
  agendaUid: string,
  near: LatLng,
  w: TimeWindow,
  now: Date = new Date(),
  agendaSlug?: string,
  lang: Lang = 'fr',
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
  const longDescription = plainText(text(ev.longDescription));
  const conditions = text(ev.conditions);
  const category = categorize(title, description, keywords.join(' '));
  const genres =
    category === 'concert' || category === 'soiree'
      ? detectGenres(title, description, keywords.join(' '), longDescription)
      : [];
  const ticket = ev.registration?.find((r) => r.type === 'link' && r.value?.startsWith('http'));
  const nativeTitle = nativeText(ev.title, lang);
  const event: AgendaEvent = {
    id: `oa-${agendaUid}-${ev.uid ?? ev.slug ?? title}`,
    title: nativeTitle ?? title,
    description: nativeTitle ? (nativeText(ev.description, lang) ?? description) : description,
    category,
    venueName: loc.name ?? translate(lang, 'Lieu à préciser'),
    location,
    address: loc.address,
    start: timing.start.toISOString(),
    end: timing.end?.toISOString(),
    timeLabel: timeLabel(timing.start, timing.end, w, now, lang),
    dateLabel: dateLabel(timing.start, timing.end, lang),
    ongoing: timing.start <= now,
    price: conditions?.slice(0, 60),
    free: isFree(conditions, description),
    url: openAgendaEventUrl(agendaSlug, ev.slug),
    ticketUrl: ticket?.value,
    imageUrl: imageUrl(ev.image),
    featured: false,
    source: 'openagenda',
    distanceMeters: Math.round(haversineMeters(near, location)),
    ...(longDescription && longDescription !== description ? { longDescription } : {}),
    ...(genres.length ? { genres } : {}),
  };
  if (nativeTitle) {
    natives.add(event);
    const nativeLong = plainText(nativeText(ev.longDescription, lang));
    if (nativeLong) event.longDescription = nativeLong;
    else delete event.longDescription;
  }
  return event;
}

const openAgendaCache = new TtlCache<OpenAgendaEvent[]>(15 * 60_000, 50);

/**
 * Journées de sortie (6 h → 6 h, heure de Lille) qui couvrent la fenêtre. Chaque
 * journée est demandée en entier, même « aujourd'hui » : un événement commencé ce
 * matin (expo 14 h – 19 h) reste ainsi dans la réponse ; overlaps() trie ensuite.
 */
export function outingDays(w: TimeWindow): TimeWindow[] {
  const p = parisParts(w.start);
  let day = p.minutes < 6 * 60 ? addDays(p.date, -1) : p.date;
  const days: TimeWindow[] = [];
  for (let i = 0; i < 9; i++) {
    const start = parisTime(day, 6);
    if (start >= w.end) break;
    const next = addDays(day, 1);
    days.push({ start, end: parisTime(next, 6) });
    day = next;
  }
  return days;
}

/** Une journée de l'agenda (jusqu'à 3 pages de 100), en cache 15 min. */
async function fetchOpenAgendaDay(uid: string, key: string, day: TimeWindow): Promise<OpenAgendaEvent[]> {
  const cacheKey = `${uid}|${day.start.toISOString()}`;
  const hit = openAgendaCache.get(cacheKey);
  if (hit) return hit;

  const events: OpenAgendaEvent[] = [];
  let after: unknown[] | undefined;
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({
      key,
      size: '100',
      detailed: '1',
      'timings[gte]': day.start.toISOString(),
      'timings[lte]': day.end.toISOString(),
    });
    for (const a of after ?? []) q.append('after[]', String(a));
    const res = await fetch(`${OPENAGENDA_URL}/agendas/${encodeURIComponent(uid)}/events?${q}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`OpenAgenda ${res.status}`);
    const body = (await res.json()) as { events?: OpenAgendaEvent[]; after?: unknown[] | null };
    events.push(...(body.events ?? []));
    if (!body.after?.length || (body.events?.length ?? 0) < 100) break;
    after = body.after;
  }
  openAgendaCache.set(cacheKey, events);
  return events;
}

/**
 * Événements de la fenêtre, journée par journée et en parallèle : une semaine
 * entière ne dépasse plus le nombre de pages (des événements disparaissaient),
 * et « aujourd'hui », « demain » et « la semaine » partagent le même cache.
 */
async function fetchOpenAgenda(uid: string, key: string, w: TimeWindow): Promise<OpenAgendaEvent[]> {
  const days = await Promise.all(outingDays(w).map((day) => fetchOpenAgendaDay(uid, key, day)));
  const seen = new Set<string>();
  return days.flat().filter((ev) => {
    const id = String(ev.uid ?? ev.slug ?? text(ev.title));
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Adresse publique des agendas (« ville-de-lille »), pour les liens vers openagenda.com.
const KNOWN_SLUGS: Record<string, string> = { [VILLE_DE_LILLE_AGENDA]: 'ville-de-lille' };
const slugCache = new TtlCache<string>(24 * 3_600_000, 20);

async function agendaSlug(uid: string, key: string): Promise<string | undefined> {
  if (KNOWN_SLUGS[uid]) return KNOWN_SLUGS[uid];
  const hit = slugCache.get(uid);
  if (hit) return hit;
  try {
    const res = await fetch(`${OPENAGENDA_URL}/agendas/${encodeURIComponent(uid)}?key=${key}`, {
      signal: AbortSignal.timeout(4000),
    });
    const slug = res.ok ? ((await res.json()) as { slug?: string }).slug : undefined;
    if (slug) slugCache.set(uid, slug);
    return slug;
  } catch {
    return undefined;
  }
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

/**
 * À la une d'abord ; puis ce qui commence bientôt, par heure ; les événements déjà
 * en cours (souvent des expos toute la journée) passent après.
 */
export function sortEvents(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(a.ongoing) - Number(b.ongoing) ||
      a.start.localeCompare(b.start) ||
      a.distanceMeters - b.distanceMeters,
  );
}

const dedupKey = (e: AgendaEvent) =>
  `${e.title}|${e.venueName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Événement partenaire sans image mais rattaché à une fiche Google : on montre la
 * photo principale de la fiche (via /api/photo, la clé Google reste sur le serveur).
 */
async function withPlacePhotos(events: AgendaEvent[], origin?: string): Promise<AgendaEvent[]> {
  if (!origin) return events;
  return Promise.all(
    events.map(async (e) => {
      if (e.imageUrl || !e.placeId) return e;
      const name = await mainPhotoName(e.placeId);
      return name ? { ...e, imageUrl: `${origin}/api/photo?name=${encodeURIComponent(name)}&w=800` } : e;
    }),
  );
}

/** Diagnostic (?debug=1) : ce que chaque source a renvoyé, sans jamais la clé. */
export interface AgendaDebug {
  window: { start: string; end: string };
  partnerEvents: number;
  openAgendaKey: boolean;
  agendas: {
    uid: string;
    fetched?: number;
    cultural?: number;
    mapped?: number;
    sample?: string[];
    error?: string;
  }[];
  ticketmaster?: { key: boolean; fetched?: number; mapped?: number; error?: string };
  merged?: number;
  withinRadius?: number;
  translate?: { enabled: boolean; lang?: string; probe?: string; lastError?: string };
}

export async function agenda(
  near: LatLng,
  when: AgendaWhen,
  now: Date = new Date(),
  lang: Lang = 'fr',
  debug?: AgendaDebug,
  /** Adresse du serveur (https://…), pour les photos Google des événements partenaires. */
  origin?: string,
): Promise<AgendaEvent[]> {
  const w = windowFor(when, now);
  const partner = await withPlacePhotos(
    (await getContent('events'))
      .map((item) => fromPartnerEvent(item, near, w, now, lang))
      .filter((e): e is AgendaEvent => e !== null),
    origin,
  );

  const oa = openAgendaConfig();
  if (debug) {
    debug.window = { start: w.start.toISOString(), end: w.end.toISOString() };
    debug.partnerEvents = partner.length;
    debug.openAgendaKey = Boolean(oa);
  }
  const external = oa
    ? (
        await Promise.all(
          oa.agendas.map(async (uid) => {
            try {
              const [events, slug] = await Promise.all([
                fetchOpenAgenda(uid, oa.key, w),
                agendaSlug(uid, oa.key),
              ]);
              const cultural = events.filter(isCulturalHighlight);
              const mapped = cultural.map((ev) => fromOpenAgenda(ev, uid, near, w, now, slug, lang));
              debug?.agendas.push({
                uid,
                fetched: events.length,
                cultural: cultural.length,
                mapped: mapped.filter(Boolean).length,
                sample: events.slice(0, 5).map((ev) => text(ev.title) ?? '?'),
              });
              return mapped;
            } catch (error) {
              console.error('[agenda] OpenAgenda indisponible', uid, error);
              const message = error instanceof Error ? error.message : String(error);
              debug?.agendas.push({ uid, error: oa.key ? message.replaceAll(oa.key, '***') : message });
              return [];
            }
          }),
        )
      ).flat()
    : [];

  // Ticketmaster : gros concerts et spectacles (Zénith, Aéronef, Splendid…).
  const tmKey = ticketmasterKey();
  if (debug) debug.ticketmaster = { key: Boolean(tmKey) };
  let ticketmaster: (AgendaEvent | null)[] = [];
  if (tmKey) {
    try {
      const raw = await fetchTicketmaster(tmKey, w);
      ticketmaster = raw
        .map((ev) =>
          fromTicketmaster(
            ev,
            near,
            (start, end) => ({
              timeLabel: timeLabel(start, end, w, now, lang),
              dateLabel: dateLabel(start, end, lang),
              ongoing: start <= now,
            }),
            lang,
          ),
        )
        .filter((e) => e !== null && overlaps(new Date(e.start), e.end ? new Date(e.end) : undefined, w));
      if (debug) debug.ticketmaster = { key: true, fetched: raw.length, mapped: ticketmaster.length };
    } catch (error) {
      console.error('[agenda] Ticketmaster indisponible', error);
      const message = error instanceof Error ? error.message : String(error);
      if (debug) debug.ticketmaster = { key: true, error: message.replaceAll(tmKey, '***') };
    }
  }

  // Doublons (même titre au même endroit) : le partenaire d'abord, puis la 1re occurrence.
  const seen = new Set<string>();
  const merged = [...partner, ...external, ...ticketmaster].filter((e): e is AgendaEvent => {
    if (!e) return false;
    const key = dedupKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const events = sortEvents(merged.filter((e) => e.distanceMeters <= RADIUS_METERS)).slice(0, MAX_EVENTS);
  if (debug) {
    debug.merged = merged.length;
    debug.withinRadius = merged.filter((e) => e.distanceMeters <= RADIUS_METERS).length;
  }
  if (lang === 'fr') return events;
  const localized = await localizeEvents(events, lang);
  if (debug) debug.translate = { enabled: isAutoTranslateEnabled(), lastError: lastTranslateError };
  return localized;
}

/**
 * Autre langue que le français : traduction automatique des textes restés en français.
 * La description longue n'est pas traduite (trop coûteuse) : la fiche affiche alors
 * la description courte, traduite.
 */
async function localizeEvents(events: AgendaEvent[], lang: Lang): Promise<AgendaEvent[]> {
  const french = events
    .filter((e) => !natives.has(e))
    .map(({ longDescription: _long, ...e }): AgendaEvent => e);
  const translated = await translateFields(french, ['title', 'description', 'price'], lang);
  const byId = new Map(translated.map((e) => [e.id, e]));
  return events.map((e) => byId.get(e.id) ?? e);
}
