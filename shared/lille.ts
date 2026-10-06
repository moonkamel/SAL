// Lille « intramuros » : la commune de Lille, sans ses communes associées (Lomme,
// Hellemmes) ni les villes voisines (La Madeleine, Lambersart, Villeneuve-d'Ascq…).

import type { LatLng } from './types';

/** Codes postaux de Lille (59777 : Euralille). Lomme (59160) et Hellemmes (59260) n'en font pas partie. */
export const LILLE_POSTCODES = new Set(['59000', '59800', '59777']);

/** Rectangle qui englobe Lille : limite les recherches Google (le contour exact trie ensuite). */
export const LILLE_RECTANGLE = {
  low: { lat: 50.6, lng: 3.02 },
  high: { lat: 50.658, lng: 3.108 },
};

/**
 * Contour simplifié de Lille (lat, lng), dans le sens des aiguilles d'une montre
 * depuis les Bois-Blancs. Approximatif à une centaine de mètres près : sert quand
 * l'adresse ne donne ni code postal ni ville.
 */
const LILLE_OUTLINE: [number, number][] = [
  [50.6475, 3.028],
  [50.656, 3.044],
  [50.6545, 3.061],
  [50.652, 3.072],
  [50.649, 3.088],
  [50.644, 3.1],
  [50.633, 3.105],
  [50.621, 3.098],
  [50.611, 3.088],
  [50.602, 3.07],
  [50.604, 3.048],
  [50.615, 3.033],
  [50.633, 3.023],
];

/** Point dans le contour de Lille (algorithme du rayon). */
export function insideLilleOutline(p: LatLng): boolean {
  let inside = false;
  for (let i = 0, j = LILLE_OUTLINE.length - 1; i < LILLE_OUTLINE.length; j = i++) {
    const [latI, lngI] = LILLE_OUTLINE[i]!;
    const [latJ, lngJ] = LILLE_OUTLINE[j]!;
    if (latI > p.lat !== latJ > p.lat && p.lng < ((lngJ - lngI) * (p.lat - latI)) / (latJ - latI) + lngI) {
      inside = !inside;
    }
  }
  return inside;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Le lieu est-il dans Lille intramuros ? D'abord le code postal (le plus fiable),
 * puis la ville, puis la position sur le contour de la commune.
 */
export function isInLille(place: { location: LatLng; address?: string; postalCode?: string; city?: string }): boolean {
  const code = place.postalCode?.trim() || place.address?.match(/\b(59\d{3})\b/)?.[1];
  if (code) return LILLE_POSTCODES.has(code);
  if (place.city) return normalize(place.city) === 'lille';
  return insideLilleOutline(place.location);
}
