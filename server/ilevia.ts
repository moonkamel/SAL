// Prochains passages Ilévia (métro, tram, bus) en temps réel, depuis l'open data de la
// Métropole Européenne de Lille (API OGC Features, GeoServer).
// Le jeu de données ne donne PAS la position des arrêts (geometry: null) et refuse le
// filtre bbox : on recherche donc les passages par NOM d'arrêt, celui que Google donne
// dans les trajets (« Rihour », « Gare Lille Flandres »…).
// Une clé API MEL est facultative (MEL_API_KEY) ; ILEVIA_PASSAGES_URL permet de
// changer d'adresse.

import type { StopDeparturesResponse, TransitDeparture } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';

export const ILEVIA_PASSAGES_URL =
  process.env.ILEVIA_PASSAGES_URL ??
  'https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/dsp_ilevia%3Aprochains_passages/items';

const MAX_TIMES = 3;

/** Un passage à un arrêt. */
export interface Passage {
  station: string;
  line: string;
  direction: string;
  time: string;
}

type Json = Record<string, unknown>;

/** Lit un champ sans tenir compte de la casse ni des « _ » (nom_station = nomstation). */
function field(obj: Json | undefined, name: string): unknown {
  if (!obj) return undefined;
  const key = Object.keys(obj).find((k) => k.toLowerCase().replace(/[_\s]/g, '') === name);
  return key ? obj[key] : undefined;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** GeoJSON (properties), Opendatasoft v1 (fields) ou objet à plat. */
export function toPassage(raw: unknown): Passage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Json;
  const props = (record.properties ?? record.fields ?? record) as Json;
  const station = str(field(props, 'nomstation'));
  const line = str(field(props, 'codeligne'));
  const time = str(field(props, 'heureestimeedepart'));
  if (!station || !line || !time) return null;
  return { station, line, direction: str(field(props, 'sensligne')), time };
}

/** Enregistrements d'une réponse, quel que soit le format. */
export function recordsOf(json: unknown): unknown[] {
  const j = (json ?? {}) as Json;
  for (const key of ['features', 'records', 'results']) {
    if (Array.isArray(j[key])) return j[key] as unknown[];
  }
  return Array.isArray(json) ? json : [];
}

/** « République - Beaux-Arts » et « REPUBLIQUE BEAUX ARTS » → « REPUBLIQUE BEAUX ARTS ». */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Même arrêt : noms identiques, ou l'un est le début de l'autre (« GARE LILLE FLANDRES » / « GARE LILLE FLANDRES METRO »). */
export function sameStation(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

/** Part des mots de la direction Google présents dans la direction Ilévia (0 à 1). */
export function directionScore(ilevia: string, google: string): number {
  const words = normalizeName(google).split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const target = ` ${normalizeName(ilevia)} `;
  return words.filter((w) => target.includes(` ${w} `)).length / words.length;
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

/** Prochains départs à un arrêt, par ligne et direction, métro d'abord. */
export function departuresAt(
  records: unknown[],
  stopName: string,
  now: Date = new Date(),
): TransitDeparture[] {
  const lines = new Map<string, TransitDeparture>();
  for (const raw of records) {
    const p = toPassage(raw);
    if (!p || !sameStation(p.station, stopName)) continue;
    const minutes = Math.round((parseDepartureTime(p.time) - now.getTime()) / 60_000);
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 90) continue;
    const key = `${p.line}|${p.direction}`;
    const dep = lines.get(key) ?? { line: p.line, direction: prettyName(p.direction), minutes: [] };
    dep.minutes.push(minutes);
    lines.set(key, dep);
  }
  return [...lines.values()]
    .map((d) => ({ ...d, minutes: d.minutes.sort((a, b) => a - b).slice(0, MAX_TIMES) }))
    .sort((a, b) => lineRank(a.line) - lineRank(b.line) || a.minutes[0]! - b.minutes[0]!);
}

/** Métro d'abord, puis tram, puis bus. */
function lineRank(line: string): number {
  const l = line.toUpperCase();
  if (/^M\d/.test(l) || l.startsWith('METRO')) return 0;
  if (/^(R|T|TRAM)/.test(l)) return 1;
  return 2;
}

// Tout le réseau tient en une réponse (~4 500 passages) : on la partage 30 s entre
// tous les utilisateurs plutôt que d'interroger la MEL arrêt par arrêt.
const cache = new TtlCache<unknown[]>(30 * 1000, 2);

async function allPassages(): Promise<unknown[]> {
  const hit = cache.get('all');
  if (hit) return hit;
  const url = new URL(ILEVIA_PASSAGES_URL);
  url.searchParams.set('f', 'application/geo+json');
  url.searchParams.set('limit', '10000');
  if (process.env.MEL_API_KEY) url.searchParams.set('apikey', process.env.MEL_API_KEY);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new PlacesError('Horaires Ilévia injoignables', 502);
  }
  if (!res.ok) {
    console.error('[ilevia] prochains passages indisponibles', res.status, await res.text().catch(() => ''));
    throw new PlacesError('Horaires Ilévia indisponibles', 502);
  }
  const records = recordsOf(await res.json());
  cache.set('all', records);
  return records;
}

export async function stopDepartures(stopName: string): Promise<StopDeparturesResponse> {
  const records = await allPassages();
  return { stop: stopName, departures: departuresAt(records, stopName) };
}
