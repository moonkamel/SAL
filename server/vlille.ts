// V'Lille en temps réel via le flux standard GBFS publié par Ilévia (licence ouverte).
// Compatible GBFS 2.x et 3.0. Les données sont rafraîchies chaque minute par Ilévia.

import { estimateWalkMinutes, haversineMeters } from '@/shared/geo';
import type { LatLng, VlilleResponse, VlilleStation } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';
import { tx } from '@/shared/i18n';

export const VLILLE_GBFS_URL =
  process.env.VLILLE_GBFS_URL ?? 'https://media.ilevia.fr/opendata/gbfs.json';

type Localized = string | { text: string; language?: string }[];

interface GbfsFeed {
  name: string;
  url: string;
}

interface GbfsStationInfo {
  station_id: string;
  name: Localized;
  lat: number;
  lon: number;
}

interface GbfsStationStatus {
  station_id: string;
  num_bikes_available?: number;
  num_vehicles_available?: number; // GBFS 3.0
  num_docks_available?: number;
  is_installed?: boolean | number;
  is_renting?: boolean | number;
  is_returning?: boolean | number;
  last_reported?: number | string;
}

/** GBFS 2.x : data.{langue}.feeds ; GBFS 3.0 : data.feeds. */
export function feedUrls(gbfs: unknown): Record<string, string> {
  const data = (gbfs as { data?: Record<string, unknown> })?.data ?? {};
  const feeds: GbfsFeed[] = Array.isArray(data.feeds)
    ? (data.feeds as GbfsFeed[])
    : ((Object.values(data).find(
        (v) => typeof v === 'object' && v !== null && Array.isArray((v as { feeds?: unknown }).feeds),
      ) as { feeds: GbfsFeed[] } | undefined)?.feeds ?? []);
  return Object.fromEntries(feeds.map((f) => [f.name, f.url]));
}

function localizedName(name: Localized): string {
  if (typeof name === 'string') return name;
  return (name.find((n) => n.language?.startsWith('fr')) ?? name[0])?.text ?? '';
}

const truthy = (v: boolean | number | undefined) => v === undefined || v === true || v === 1;

/** Joint information et statut des stations (tous deux au format GBFS). */
export function mergeStations(
  info: GbfsStationInfo[],
  status: GbfsStationStatus[],
): Omit<VlilleStation, 'distanceMeters' | 'walkMinutes'>[] {
  const byId = new Map(status.map((s) => [s.station_id, s]));
  return info.flatMap((i) => {
    const s = byId.get(i.station_id);
    if (!s) return [];
    return [
      {
        id: i.station_id,
        name: localizedName(i.name),
        location: { lat: i.lat, lng: i.lon },
        bikes: s.num_bikes_available ?? s.num_vehicles_available ?? 0,
        docks: s.num_docks_available ?? 0,
        operational: truthy(s.is_installed) && truthy(s.is_renting) && truthy(s.is_returning),
      },
    ];
  });
}

export function nearestStations(
  stations: Omit<VlilleStation, 'distanceMeters' | 'walkMinutes'>[],
  from: LatLng,
  limit: number,
): VlilleStation[] {
  return stations
    .filter((s) => s.operational)
    .map((s) => {
      const distanceMeters = Math.round(haversineMeters(from, s.location));
      return { ...s, distanceMeters, walkMinutes: estimateWalkMinutes(distanceMeters) };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    console.error('[vlille] requête GBFS échouée', res.status, url);
    throw new PlacesError(tx('Données V’Lille indisponibles'), 502);
  }
  return res.json();
}

// Informations de station (noms, positions) : quasi statiques, 1 h de cache.
const infoCache = new TtlCache<GbfsStationInfo[]>(60 * 60 * 1000, 2);
// Disponibilités : le flux est mis à jour chaque minute.
const statusCache = new TtlCache<{ stations: GbfsStationStatus[]; updatedAt?: string }>(
  45 * 1000,
  2,
);
const feedCache = new TtlCache<Record<string, string>>(60 * 60 * 1000, 2);

async function loadStations() {
  let feeds = feedCache.get('feeds');
  if (!feeds) {
    feeds = feedUrls(await getJson(VLILLE_GBFS_URL));
    feedCache.set('feeds', feeds);
  }
  const infoUrl = feeds.station_information;
  const statusUrl = feeds.station_status;
  if (!infoUrl || !statusUrl) throw new PlacesError(tx('Données V’Lille indisponibles'), 502);

  let info = infoCache.get('info');
  if (!info) {
    const json = (await getJson(infoUrl)) as { data?: { stations?: GbfsStationInfo[] } };
    info = json.data?.stations ?? [];
    infoCache.set('info', info);
  }
  let status = statusCache.get('status');
  if (!status) {
    const json = (await getJson(statusUrl)) as {
      last_updated?: number | string;
      data?: { stations?: GbfsStationStatus[] };
    };
    const lu = json.last_updated;
    status = {
      stations: json.data?.stations ?? [],
      updatedAt:
        typeof lu === 'number' ? new Date(lu * 1000).toISOString() : typeof lu === 'string' ? lu : undefined,
    };
    statusCache.set('status', status);
  }
  return { stations: mergeStations(info, status.stations), updatedAt: status.updatedAt };
}

export async function vlilleNear(from: LatLng, limit = 3): Promise<VlilleResponse> {
  const { stations, updatedAt } = await loadStations();
  return { stations: nearestStations(stations, from, limit), updatedAt };
}
