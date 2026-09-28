// Guidage pas à pas « maison » (à pied, à vélo) à partir d'un itinéraire Mapbox Directions :
// position sur le tracé, étape en cours, annonces vocales, écart d'itinéraire, arrivée.
// Logique pure, sans React, testée.

import { haversineMeters } from './geo';
import type { LatLng } from './types';

export interface Maneuver {
  type: string; // depart, turn, continue, arrive, roundabout…
  modifier?: string; // left, slight right, straight, uturn…
}

export interface GuideStep {
  /** Instruction écrite de la manœuvre qui TERMINE cette étape (celle à venir). */
  banner: string;
  /** Manœuvre à venir (fin de l'étape). */
  maneuver: Maneuver;
  /** Distance (m) depuis le départ jusqu'au début de l'étape. */
  start: number;
  distance: number;
  /** Annonces vocales : à dire quand il reste `at` mètres avant la fin de l'étape. */
  voice: { at: number; text: string }[];
  /** Nom de la rue empruntée pendant l'étape. */
  street: string;
}

export interface GuideRoute {
  coords: LatLng[];
  /** Distance cumulée (m) à chaque point du tracé. */
  cum: number[];
  steps: GuideStep[];
  distance: number;
  duration: number;
}

interface MbStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string; instruction?: string };
  voiceInstructions?: { distanceAlongGeometry?: number; announcement?: string }[];
  bannerInstructions?: { distanceAlongGeometry?: number; primary?: { text?: string; type?: string; modifier?: string } }[];
}

interface MbRoute {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: { steps?: MbStep[] }[];
}

/** Réponse Mapbox Directions (geometries=geojson, steps, voice & banner instructions). */
export function parseMapboxRoute(json: unknown): GuideRoute | null {
  const route = (json as { routes?: MbRoute[] })?.routes?.[0];
  const raw = route?.geometry?.coordinates;
  if (!route || !raw || raw.length < 2) return null;
  const coords = raw.map(([lng, lat]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1]! + haversineMeters(coords[i - 1]!, coords[i]!));

  const mbSteps = route.legs?.flatMap((l) => l.steps ?? []) ?? [];
  const steps: GuideStep[] = [];
  let start = 0;
  for (let i = 0; i < mbSteps.length; i++) {
    const s = mbSteps[i]!;
    const next = mbSteps[i + 1];
    const banner = s.bannerInstructions?.[0]?.primary;
    steps.push({
      banner: banner?.text ?? next?.maneuver?.instruction ?? s.maneuver?.instruction ?? '',
      maneuver: {
        type: banner?.type ?? next?.maneuver?.type ?? s.maneuver?.type ?? 'continue',
        modifier: banner?.modifier ?? next?.maneuver?.modifier ?? s.maneuver?.modifier,
      },
      start,
      distance: s.distance ?? 0,
      voice: (s.voiceInstructions ?? [])
        .filter((v) => v.announcement)
        .map((v) => ({ at: v.distanceAlongGeometry ?? 0, text: v.announcement! }))
        .sort((a, b) => b.at - a.at),
      street: s.name ?? '',
    });
    start += s.distance ?? 0;
  }
  return { coords, cum, steps, distance: route.distance ?? cum[cum.length - 1]!, duration: route.duration ?? 0 };
}

/** Projection d'un point sur un segment, en mètres (repère local). */
function project(p: LatLng, a: LatLng, b: LatLng): { t: number; dist: number } {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ax = (a.lng - p.lng) * k;
  const ay = (a.lat - p.lat) * 111_320;
  const bx = (b.lng - p.lng) * k;
  const by = (b.lat - p.lat) * 111_320;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return { t, dist: Math.hypot(ax + t * dx, ay + t * dy) };
}

export interface Progress {
  /** Distance parcourue le long du tracé (m). */
  along: number;
  /** Écart au tracé (m). */
  offset: number;
  step: number;
  /** Distance jusqu'à la prochaine manœuvre (m). */
  toManeuver: number;
  remainingMeters: number;
  remainingSeconds: number;
  arrived: boolean;
}

/**
 * Où en est l'utilisateur. On cherche le point du tracé le plus proche, en privilégiant
 * les segments autour de la position précédente : un tracé qui repasse près de lui-même
 * ne fait pas sauter en arrière.
 */
export function progressOn(route: GuideRoute, position: LatLng, previousAlong = 0): Progress {
  let best = { along: 0, dist: Infinity };
  for (let i = 1; i < route.coords.length; i++) {
    const { t, dist } = project(position, route.coords[i - 1]!, route.coords[i]!);
    const along = route.cum[i - 1]! + t * (route.cum[i]! - route.cum[i - 1]!);
    // Pénalité pour un retour en arrière de plus de 50 m.
    const penalty = along < previousAlong - 50 ? 40 : 0;
    if (dist + penalty < best.dist) best = { along, dist: dist + penalty };
  }
  const along = best.along;
  const offset = Math.round(best.dist);
  let step = 0;
  while (step < route.steps.length - 1 && route.steps[step + 1]!.start <= along) step++;
  const s = route.steps[step];
  const toManeuver = s ? Math.max(0, s.start + s.distance - along) : 0;
  const remainingMeters = Math.max(0, route.distance - along);
  const dest = route.coords[route.coords.length - 1]!;
  return {
    along,
    offset,
    step,
    toManeuver: Math.round(toManeuver),
    remainingMeters: Math.round(remainingMeters),
    remainingSeconds: route.distance > 0 ? Math.round((route.duration * remainingMeters) / route.distance) : 0,
    arrived: remainingMeters < 15 || haversineMeters(position, dest) < 20,
  };
}

/** Hors itinéraire : plus loin que la précision GPS le permet. */
export function isOffRoute(progress: Progress, accuracyMeters = 10): boolean {
  return progress.offset > Math.max(35, accuracyMeters * 1.5);
}

/**
 * Annonces à dire maintenant : celles de l'étape en cours dont le seuil est atteint et
 * qui n'ont pas encore été dites (clé « étape:seuil »).
 */
export function dueAnnouncements(route: GuideRoute, progress: Progress, spoken: Set<string>): string[] {
  const s = route.steps[progress.step];
  if (!s) return [];
  const out: string[] = [];
  for (const v of s.voice) {
    const key = `${progress.step}:${v.at}`;
    if (!spoken.has(key) && progress.toManeuver <= v.at + 5) {
      spoken.add(key);
      out.push(v.text);
    }
  }
  // Une seule phrase à la fois : la plus proche de la manœuvre.
  return out.slice(-1);
}

/** « 150 m », « 1,2 km ». */
export function formatGuideDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
