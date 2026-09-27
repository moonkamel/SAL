import type { Ambiance, VlilleStation } from '@/shared/types';

/** Première station (déjà triée par distance) qui a au moins un vélo, ou une place. */
export function pickStation(
  stations: VlilleStation[],
  need: 'bikes' | 'docks',
): VlilleStation | undefined {
  return stations.find((s) => s[need] > 0);
}

/** « Maintenant », « 1 min », « 12 min ». */
export function formatWait(minutes: number): string {
  return minutes <= 0 ? 'Maintenant' : `${minutes} min`;
}

/** Couleurs des lignes Ilévia (métro 1 jaune, métro 2 rouge, tram, bus). */
export function lineColor(line: string): string {
  const l = line.toUpperCase();
  if (l === 'M1' || l === '1') return '#F2C230';
  if (l === 'M2' || l === '2') return '#D8322B';
  if (/^(R|T|TRAM)/.test(l)) return '#1FA3A0';
  return '#5B6286';
}

export const AMBIANCE_ICONS: Record<Ambiance, string> = {
  terrace: 'sunny',
  liveMusic: 'musical-notes',
  groups: 'people',
  kids: 'happy',
  cocktails: 'wine',
  vegetarian: 'leaf',
  accessible: 'accessibility',
};
