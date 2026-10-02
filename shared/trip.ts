// Trajets en transports : tracés et horaires affichés. Logique pure (sans React), testée.

import { decodePolyline } from './polyline';
import type { LatLng, TripSegment } from './types';

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
