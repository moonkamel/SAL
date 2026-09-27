// Prochains passages Ilévia (métro, tram, bus) en temps réel, depuis la plateforme
// open data de la Métropole Européenne de Lille (API OGC Features).
// Une clé API MEL est facultative (MEL_API_KEY) mais recommandée en production.

import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { LatLng, TransitDeparture, TransitResponse, TransitStop } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';

export const ILEVIA_PASSAGES_URL =
  process.env.ILEVIA_PASSAGES_URL ??
  'https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/dsp_ilevia%3Aprochains_passages/items';

/** Rayon de recherche des arrêts autour d'un point (≈ 8 min à pied). */
export const TRANSIT_RADIUS_METERS = 600;
const MAX_STOPS = 2;
const MAX_TIMES = 3;

interface PassageFeature {
  geometry?: { type: string; coordinates?: [number, number] } | null;
  properties: {
    nom_station?: string;
    code_ligne?: string;
    sens_ligne?: string;
    heure_estimee_depart?: string;
  };
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
export function groupPassages(
  features: PassageFeature[],
  from: LatLng,
  now: Date = new Date(),
): TransitStop[] {
  const stops = new Map<string, { location: LatLng; lines: Map<string, TransitDeparture> }>();

  for (const f of features) {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    if (!p.nom_station || !p.code_ligne || !p.heure_estimee_depart || !coords) continue;
    const minutes = Math.round((parseDepartureTime(p.heure_estimee_depart) - now.getTime()) / 60_000);
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 90) continue;

    const stop = stops.get(p.nom_station) ?? {
      location: { lat: coords[1], lng: coords[0] },
      lines: new Map<string, TransitDeparture>(),
    };
    const key = `${p.code_ligne}|${p.sens_ligne ?? ''}`;
    const dep = stop.lines.get(key) ?? {
      line: p.code_ligne,
      direction: prettyName(p.sens_ligne ?? ''),
      minutes: [],
    };
    dep.minutes.push(minutes);
    stop.lines.set(key, dep);
    stops.set(p.nom_station, stop);
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

export async function transitNear(from: LatLng): Promise<TransitResponse> {
  // ~100 m de précision : les voisins partagent le même cache (30 s).
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = new URL(ILEVIA_PASSAGES_URL);
  url.searchParams.set('f', 'json');
  url.searchParams.set('limit', '500');
  url.searchParams.set('bbox', bboxAround(from, TRANSIT_RADIUS_METERS).join(','));
  if (process.env.MEL_API_KEY) url.searchParams.set('apikey', process.env.MEL_API_KEY);

  const res = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!res.ok) {
    console.error('[ilevia] prochains passages indisponibles', res.status);
    throw new PlacesError('Horaires Ilévia indisponibles', 502);
  }
  const json = (await res.json()) as { features?: PassageFeature[] };
  const result = { stops: groupPassages(json.features ?? [], from) };
  cache.set(key, result);
  return result;
}
