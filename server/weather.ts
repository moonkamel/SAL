// Météo actuelle via Open-Meteo (gratuit, sans clé, licence CC BY 4.0).

import { conditionFromCode } from '@/shared/suggest';
import type { LatLng, Weather } from '@/shared/types';

import { TtlCache } from './cache';
import { PlacesError } from './places';
import { tx } from '@/shared/i18n';

export const OPEN_METEO_URL = process.env.OPEN_METEO_URL ?? 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoCurrent {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

export function parseWeather(body: unknown): Weather {
  const c = (body as OpenMeteoCurrent)?.current;
  if (typeof c?.temperature_2m !== 'number' || typeof c.weather_code !== 'number') {
    throw new PlacesError(tx('Réponse météo invalide'), 502);
  }
  return {
    temperature: c.temperature_2m,
    condition: conditionFromCode(c.weather_code),
    isDay: c.is_day !== 0,
  };
}

// Le temps change peu en 10 min, et toute la métropole partage à peu près le même ciel.
const cache = new TtlCache<Weather>(10 * 60_000, 100);

export async function currentWeather(near: LatLng): Promise<Weather> {
  const key = `${near.lat.toFixed(1)},${near.lng.toFixed(1)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url =
    `${OPEN_METEO_URL}?latitude=${near.lat.toFixed(3)}&longitude=${near.lng.toFixed(3)}` +
    '&current=temperature_2m,weather_code,is_day&timezone=Europe%2FParis';
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new PlacesError(tx('Météo injoignable'), 502);
  }
  if (!res.ok) throw new PlacesError(`Open-Meteo ${res.status}`, 502);
  const weather = parseWeather(await res.json());
  cache.set(key, weather);
  return weather;
}
