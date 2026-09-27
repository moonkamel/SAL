// Idées de sortie selon l'heure et la météo (logique pure, testée).

import type { Ambiance, Suggestion, Weather, WeatherCondition } from './types';

/** Heure locale à Lille (le serveur peut tourner en UTC). */
export function parisHour(date: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('fr-FR', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'Europe/Paris',
  }).format(date);
  return Number.parseInt(h, 10) % 24;
}

/** Codes météo WMO (Open-Meteo) → condition simplifiée. */
export function conditionFromCode(code: number): WeatherCondition {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain'; // bruine, pluie, averses (51–67, 80–82)
}

export const isWet = (w?: Weather) =>
  w !== undefined && (w.condition === 'rain' || w.condition === 'storm' || w.condition === 'snow');

/** Beau temps de terrasse : sec, lumineux et au moins 17 °C. */
export const isTerraceWeather = (w?: Weather) =>
  w !== undefined && w.condition === 'clear' && w.isDay && w.temperature >= 17;

type Slot = 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night';

export function slotOf(hour: number): Slot {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/** Carte « météo » de l'accueil. */
export function weatherSuggestion(weather: Weather, hour: number): Suggestion {
  const slot = slotOf(hour);
  const t = Math.round(weather.temperature);

  if (isWet(weather)) {
    const snow = weather.condition === 'snow';
    const byslot: Record<Slot, Pick<Suggestion, 'query' | 'subtitle'>> = {
      morning: { query: 'salon de thé', subtitle: 'Un chocolat chaud et une gaufre au sec.' },
      lunch: { query: 'estaminet', subtitle: 'Carbonade et welsh, bien au chaud.' },
      afternoon: { query: 'salon de thé', subtitle: 'Une gaufre fourrée en attendant l’éclaircie.' },
      evening: { query: 'estaminet', subtitle: 'Une bière du Nord et un welsh fumant.' },
      night: { query: 'bar à bières', subtitle: 'Au chaud, entre deux averses.' },
    };
    return {
      title: snow ? 'Il neige sur Lille' : 'Il pleut ? Classique.',
      ...byslot[slot],
    };
  }

  if (isTerraceWeather(weather)) {
    const query: Record<Slot, string> = {
      morning: 'café',
      lunch: 'restaurant',
      afternoon: 'bar',
      evening: 'bar',
      night: 'bar',
    };
    return {
      title: `${t} °C et du soleil`,
      subtitle: 'Les terrasses du Vieux-Lille vous attendent.',
      query: query[slot],
      ambiance: ['terrace'],
    };
  }

  if (weather.temperature < 6) {
    return {
      title: `${t} °C, ça pique`,
      subtitle: 'Un estaminet bien chauffé et un potjevleesch.',
      query: 'estaminet',
    };
  }

  const fallback: Record<Slot, Suggestion> = {
    morning: { title: 'Bien commencer la journée', subtitle: 'Un brunch près de chez vous.', query: 'brunch' },
    lunch: { title: 'L’heure du déjeuner', subtitle: 'Un bistrot bien noté à deux pas.', query: 'bistrot' },
    afternoon: { title: 'Une pause ?', subtitle: 'Café, gaufre ou pâtisserie.', query: 'salon de thé' },
    evening: { title: 'On sort ce soir', subtitle: 'L’apéro dans un bar à bières lillois.', query: 'bar à bières' },
    night: { title: 'La nuit est jeune', subtitle: 'Un bar à cocktails encore ouvert.', query: 'bar à cocktails' },
  };
  return fallback[slot];
}

/** Requêtes candidates pour « Surprends-moi », selon l'heure et le temps. */
export function surpriseQueries(hour: number, weather?: Weather): { queries: string[]; ambiance?: Ambiance[] } {
  const slot = slotOf(hour);
  const base: Record<Slot, string[]> = {
    morning: ['café', 'brunch', 'boulangerie pâtisserie'],
    lunch: ['restaurant', 'estaminet', 'bistrot'],
    afternoon: ['salon de thé', 'café', 'pâtisserie'],
    evening: ['restaurant', 'estaminet', 'bar à bières', 'bar à cocktails'],
    night: ['bar', 'bar à cocktails', 'bar à bières'],
  };
  if (isWet(weather)) {
    const cosy: Record<Slot, string[]> = {
      morning: ['salon de thé', 'café'],
      lunch: ['estaminet', 'restaurant'],
      afternoon: ['salon de thé', 'musée'],
      evening: ['estaminet', 'restaurant'],
      night: ['bar à bières', 'bar à cocktails'],
    };
    return { queries: cosy[slot] };
  }
  if (isTerraceWeather(weather) && slot !== 'night') {
    return { queries: base[slot], ambiance: ['terrace'] };
  }
  return { queries: base[slot] };
}

/** Choisit un élément au hasard parmi les `top` premiers (liste déjà triée). */
export function pickAmongTop<T>(items: T[], top = 5, random: () => number = Math.random): T | undefined {
  const pool = items.slice(0, top);
  if (pool.length === 0) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
