// Suivi en direct d'un trajet en transports : où en est l'utilisateur et quoi lui dire.
// Logique pure (sans React), testée.

import { haversineMeters } from './geo';
import { decodePolyline } from './polyline';
import type { LatLng, TransitItinerary, TripSegment } from './types';

type Ride = Extract<TripSegment, { kind: 'ride' }>;

/** Tracé d'un tronçon (les tronçons à pied peuvent en assembler plusieurs, séparés par un espace). */
export function segmentPoints(segment: TripSegment): LatLng[] {
  const pts = segment.polyline
    .split(' ')
    .filter(Boolean)
    .flatMap((p) => decodePolyline(p));
  if (pts.length > 1) return pts;
  return segment.kind === 'walk'
    ? [segment.from, segment.to]
    : [segment.departureStop.location, segment.arrivalStop.location];
}

/** Distance (m) d'un point à un segment [a, b], en projection locale. */
function toSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ax = (a.lng - p.lng) * k;
  const ay = (a.lat - p.lat) * 111_320;
  const bx = (b.lng - p.lng) * k;
  const by = (b.lat - p.lat) * 111_320;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToLine(p: LatLng, points: LatLng[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return haversineMeters(p, points[0]!);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, toSegment(p, points[i - 1]!, points[i]!));
  return best;
}

const endOf = (s: TripSegment) => (s.kind === 'walk' ? s.to : s.arrivalStop.location);

/** Distance à partir de laquelle on considère qu'un tronçon est terminé. */
const WALK_DONE_METERS = 35;
const RIDE_DONE_METERS = 80;
/** Distance maximale au tracé pour « être sur » un tronçon. */
const ON_ROUTE_METERS = 70;

/**
 * Tronçon en cours. On n'avance que vers l'avant : un détour ou un GPS imprécis ne
 * fait jamais revenir à une étape déjà faite.
 */
export function currentSegment(itinerary: TransitItinerary, position: LatLng, previous: number): number {
  const segs = itinerary.segments;
  let index = Math.max(0, Math.min(previous, segs.length - 1));

  // Tronçon terminé (arrivé à l'arrêt, ou descendu du véhicule) : on passe au suivant.
  while (index < segs.length - 1) {
    const seg = segs[index]!;
    const limit = seg.kind === 'walk' ? WALK_DONE_METERS : RIDE_DONE_METERS;
    if (haversineMeters(position, endOf(seg)) > limit) break;
    index += 1;
  }

  // L'utilisateur est déjà plus loin sur le trajet (ex. il a pris le métro sans ouvrir l'app).
  // Seulement s'il s'est nettement éloigné du tronçon en cours : un bus peut emprunter
  // la rue où l'on marche.
  if (distanceToLine(position, segmentPoints(segs[index]!)) < 150) return index;
  for (let i = segs.length - 1; i > index; i--) {
    const seg = segs[i]!;
    if (seg.kind === 'ride' && distanceToLine(position, segmentPoints(seg)) < ON_ROUTE_METERS / 2) {
      const nearStart = haversineMeters(position, seg.departureStop.location) < RIDE_DONE_METERS;
      if (!nearStart) return i;
    }
  }
  return index;
}

export function formatClock(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function minutesUntil(iso: string, now: Date): number {
  return Math.round((Date.parse(iso) - now.getTime()) / 60_000);
}

export function lineLabel(line: Ride['line']): string {
  return `${line.vehicle} ${line.short}`;
}

export interface LiveInstruction {
  title: string;
  subtitle: string;
  /** « prepare » : descendre au prochain arrêt ; « hurry » : départ imminent. */
  alert?: 'prepare' | 'hurry';
}

const WALK_SPEED = 1.25; // m/s

/** Ce qu'on affiche en grand pendant le trajet. */
export function liveInstruction(
  itinerary: TransitItinerary,
  index: number,
  position: LatLng,
  destinationName: string,
  now: Date = new Date(),
  /** Minutes avant le prochain passage en temps réel (Ilévia), pour le prochain véhicule. */
  realtimeWait?: number,
): LiveInstruction {
  const segs = itinerary.segments;
  const seg = segs[index];
  if (!seg) return { title: 'Vous êtes arrivé', subtitle: destinationName };

  if (seg.kind === 'walk') {
    const next = segs[index + 1];
    const meters = haversineMeters(position, seg.to);
    const walkMin = Math.max(1, Math.round(meters / WALK_SPEED / 60));
    if (!next || next.kind !== 'ride') {
      return {
        title: `Marchez jusqu’à ${destinationName}`,
        subtitle: `${walkMin} min à pied · arrivée vers ${formatClock(itinerary.arrivalTime)}`,
      };
    }
    const wait = realtimeWait ?? minutesUntil(next.departureTime, now);
    const when =
      realtimeWait !== undefined
        ? `dans ${wait} min (temps réel)`
        : `à ${formatClock(next.departureTime)}${wait >= 0 ? ` (dans ${wait} min)` : ''}`;
    return {
      title: `Marchez jusqu’à ${seg.toName}`,
      subtitle: `${walkMin} min à pied · ${lineLabel(next.line)} ${when}`,
      alert: wait >= 0 && wait <= walkMin ? 'hurry' : undefined,
    };
  }

  const atStart = haversineMeters(position, seg.departureStop.location) < RIDE_DONE_METERS;
  const wait = realtimeWait ?? minutesUntil(seg.departureTime, now);
  if (atStart && wait >= 0) {
    return {
      title: `Attendez le ${lineLabel(seg.line)}`,
      subtitle: `Direction ${seg.headsign} · départ ${wait <= 0 ? 'imminent' : `dans ${wait} min`}`,
    };
  }
  const toStop = haversineMeters(position, seg.arrivalStop.location);
  if (toStop < 500) {
    return {
      title: `Descendez au prochain arrêt`,
      subtitle: `${seg.arrivalStop.name} · ${lineLabel(seg.line)}`,
      alert: 'prepare',
    };
  }
  return {
    title: `Restez dans le ${lineLabel(seg.line)}`,
    subtitle: `Descendez à ${seg.arrivalStop.name} vers ${formatClock(seg.arrivalTime)}`,
  };
}
