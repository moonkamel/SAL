// Prochains passages Ilévia (métro, tram, bus) en temps réel, depuis la plateforme
// open data de la Métropole Européenne de Lille. La MEL a publié ce jeu de données sous
// plusieurs formes (API Opendatasoft, API OGC Features) : on essaie chaque adresse
// connue et on retient la première qui répond. ILEVIA_PASSAGES_URL permet d'imposer
// une adresse. Une clé API MEL est facultative (MEL_API_KEY).

import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { LatLng, TransitDeparture, TransitResponse, TransitStop } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';

const OGC_URL =
  'https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/dsp_ilevia%3Aprochains_passages/items';
const ODS_DATASET = 'ilevia-prochainspassages';

/** Rayon de recherche des arrêts autour d'un point (≈ 8 min à pied). */
export const TRANSIT_RADIUS_METERS = 600;
const MAX_STOPS = 2;
const MAX_TIMES = 3;

/** Un passage, quel que soit le format d'origine. */
export interface Passage {
  station: string;
  line: string;
  direction: string;
  time: string;
  location: LatLng;
}

type Json = Record<string, unknown>;

/** Lit un champ sans tenir compte de la casse ni des « _ » (nom_station = nomstation). */
function field(obj: Json | undefined, name: string): unknown {
  if (!obj) return undefined;
  const key = Object.keys(obj).find((k) => k.toLowerCase().replace(/[_\s]/g, '') === name);
  return key ? obj[key] : undefined;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function locationOf(record: Json, props: Json): LatLng | null {
  const geom = record.geometry as { coordinates?: unknown } | null | undefined;
  const c = geom?.coordinates;
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return { lat: c[1], lng: c[0] };
  }
  for (const value of Object.values(props)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Json;
      if (typeof v.lat === 'number' && typeof v.lon === 'number') return { lat: v.lat, lng: v.lon };
    }
  }
  // Opendatasoft : geo_point_2d = [lat, lon].
  const gp = field(props, 'geopoint2d');
  if (Array.isArray(gp) && typeof gp[0] === 'number' && typeof gp[1] === 'number') {
    return { lat: gp[0], lng: gp[1] };
  }
  return null;
}

/** GeoJSON (properties), Opendatasoft v1 (fields) ou v2 (objet à plat). */
export function toPassage(raw: unknown): Passage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Json;
  const props = (record.properties ?? record.fields ?? record) as Json;
  const station = str(field(props, 'nomstation'));
  const line = str(field(props, 'codeligne'));
  const time = str(field(props, 'heureestimeedepart'));
  const location = locationOf(record, props);
  if (!station || !line || !time || !location) return null;
  return { station, line, direction: str(field(props, 'sensligne')), time, location };
}

/** Enregistrements d'une réponse, quel que soit le format. */
export function recordsOf(json: unknown): unknown[] {
  const j = (json ?? {}) as Json;
  for (const key of ['features', 'records', 'results']) {
    if (Array.isArray(j[key])) return j[key] as unknown[];
  }
  return Array.isArray(json) ? json : [];
}

/** Rectangle englobant (lng/lat) d'un cercle, pour le paramètre bbox de l'API. */
export function bboxAround(center: LatLng, radiusMeters: number): [number, number, number, number] {
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}

/** « REPUBLIQUE BEAUX ARTS » → « Republique Beaux Arts » (les noms Ilévia sont en capitales). */
export function prettyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

const parisParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Décalage (ms) entre l'heure de Paris et UTC à un instant donné. */
function parisOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    parisParts.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Lit une heure Ilévia. Si elle n'indique pas de fuseau (« 2026-09-27T21:05:00 »),
 * c'est l'heure de Lille — et non celle du serveur, souvent en UTC.
 */
export function parseDepartureTime(value: string): number {
  if (/(z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) return new Date(value).getTime();
  const naiveUtc = new Date(`${value.trim()}Z`).getTime();
  if (Number.isNaN(naiveUtc)) return NaN;
  return naiveUtc - parisOffsetMs(naiveUtc - parisOffsetMs(naiveUtc));
}

/** Regroupe les passages par arrêt puis par ligne et direction, triés par proximité. */
export function groupPassages(records: unknown[], from: LatLng, now: Date = new Date()): TransitStop[] {
  const stops = new Map<string, { location: LatLng; lines: Map<string, TransitDeparture> }>();

  for (const raw of records) {
    const p = toPassage(raw);
    if (!p) continue;
    const minutes = Math.round((parseDepartureTime(p.time) - now.getTime()) / 60_000);
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 90) continue;

    const stop = stops.get(p.station) ?? {
      location: p.location,
      lines: new Map<string, TransitDeparture>(),
    };
    const key = `${p.line}|${p.direction}`;
    const dep = stop.lines.get(key) ?? {
      line: p.line,
      direction: prettyName(p.direction),
      minutes: [],
    };
    dep.minutes.push(minutes);
    stop.lines.set(key, dep);
    stops.set(p.station, stop);
  }

  return [...stops.entries()]
    .map(([name, s]) => {
      const distanceMeters = Math.round(haversineMeters(from, s.location));
      return {
        name: prettyName(name),
        location: s.location,
        distanceMeters,
        walkMinutes: estimateWalkMinutes(distanceMeters),
        departures: [...s.lines.values()]
          .map((d) => ({ ...d, minutes: d.minutes.sort((a, b) => a - b).slice(0, MAX_TIMES) }))
          .sort((a, b) => lineRank(a.line) - lineRank(b.line) || a.minutes[0]! - b.minutes[0]!),
      };
    })
    .filter((s) => s.distanceMeters <= TRANSIT_RADIUS_METERS && s.departures.length > 0)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_STOPS);
}

/** Métro d'abord, puis tram, puis bus. */
function lineRank(line: string): number {
  const l = line.toUpperCase();
  if (/^M\d/.test(l) || l.startsWith('METRO')) return 0;
  if (/^(R|T|TRAM)/.test(l)) return 1;
  return 2;
}

const cache = new TtlCache<TransitResponse>(30 * 1000, 300);

/** Adresses à essayer, dans l'ordre, pour les passages autour d'un point. */
export function sourceUrls(from: LatLng): string[] {
  const key = process.env.MEL_API_KEY;
  const ogc = (base: string) => {
    const url = new URL(base);
    url.searchParams.set('f', 'json');
    url.searchParams.set('limit', '500');
    url.searchParams.set('bbox', bboxAround(from, TRANSIT_RADIUS_METERS).join(','));
    if (key) url.searchParams.set('apikey', key);
    return url.toString();
  };
  const ods = (host: string) => {
    const url = new URL(`https://${host}/api/records/1.0/search/`);
    url.searchParams.set('dataset', ODS_DATASET);
    url.searchParams.set('rows', '500');
    url.searchParams.set('geofilter.distance', `${from.lat},${from.lng},${TRANSIT_RADIUS_METERS}`);
    if (key) url.searchParams.set('apikey', key);
    return url.toString();
  };
  const custom = process.env.ILEVIA_PASSAGES_URL;
  if (custom) return [custom.includes('/records/1.0/') ? custom : ogc(custom)];
  return [ods('data.lillemetropole.fr'), ods('opendata.lillemetropole.fr'), ogc(OGC_URL)];
}

// Index de la dernière adresse qui a fonctionné : on commence par elle.
let preferred = 0;

async function fetchRecords(from: LatLng): Promise<unknown[]> {
  const urls = sourceUrls(from);
  const order = [preferred, ...urls.keys()].filter((i, pos, all) => i < urls.length && all.indexOf(i) === pos);
  for (const i of order) {
    try {
      const res = await fetch(urls[i]!, {
        headers: { Accept: 'application/geo+json, application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        console.warn('[ilevia] source', i, 'a répondu', res.status);
        continue;
      }
      const records = recordsOf(await res.json());
      // Une source qui répond mais sans aucun passage lisible n'est pas la bonne.
      if (records.length > 0 && !records.some((r) => toPassage(r))) continue;
      preferred = i;
      return records;
    } catch (error) {
      console.warn('[ilevia] source', i, 'injoignable', error);
    }
  }
  throw new PlacesError('Horaires Ilévia indisponibles', 502);
}

export async function transitNear(from: LatLng): Promise<TransitResponse> {
  // ~100 m de précision : les voisins partagent le même cache (30 s).
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = { stops: groupPassages(await fetchRecords(from), from) };
  cache.set(key, result);
  return result;
}
