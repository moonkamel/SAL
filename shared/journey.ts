// Voyage en plusieurs étapes, enchaînées automatiquement : marche, vélo (V'Lille),
// transports (bus, métro, tram). Logique pure, testée ; l'écran JourneyScreen l'affiche.

import { haversineMeters } from './geo';
import { formatClock, minutesUntil } from './trip';
import type {
  LatLng,
  TransitItinerary,
  TransitLineInfo,
  TransitStopInfo,
  VlilleStation,
} from './types';

export interface MoveLeg {
  kind: 'walk' | 'bike';
  to: LatLng;
  /** « l'arrêt Gaston Berger », « la station V'Lille Rihour », « L'Illustration ». */
  toName: string;
  /** Durée prévue (s), pour l'heure d'arrivée estimée. */
  estimateSeconds?: number;
  /** Petite ligne d'information (ex. « 7 vélos disponibles »). */
  note?: string;
}

export interface RideLeg {
  kind: 'ride';
  line: TransitLineInfo;
  headsign: string;
  from: TransitStopInfo;
  to: TransitStopInfo;
  departureTime: string;
  arrivalTime: string;
  stopCount: number;
}

export type JourneyLeg = MoveLeg | RideLeg;

export interface Journey {
  placeId: string;
  destinationName: string;
  legs: JourneyLeg[];
}

/** Trajet en transports (Google) → étapes à enchaîner. */
export function journeyFromItinerary(it: TransitItinerary, placeId: string, destinationName: string): Journey {
  const legs: JourneyLeg[] = it.segments.map((s, i) => {
    if (s.kind === 'ride') {
      return {
        kind: 'ride',
        line: s.line,
        headsign: s.headsign,
        from: s.departureStop,
        to: s.arrivalStop,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        stopCount: s.stopCount,
      };
    }
    const last = i === it.segments.length - 1;
    return {
      kind: 'walk',
      to: s.to,
      toName: last ? destinationName : `l’arrêt ${s.toName}`,
      estimateSeconds: s.durationSeconds,
    };
  });
  return { placeId, destinationName, legs };
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * V'Lille : à pied jusqu'à une station avec des vélos, à vélo jusqu'à une station avec
 * des places, puis à pied jusqu'au lieu. Sans stations utilisables : vélo de bout en bout.
 */
export function journeyWithVlille(
  pickup: VlilleStation | undefined,
  dropoff: VlilleStation | undefined,
  destination: LatLng,
  placeId: string,
  destinationName: string,
): Journey {
  if (!pickup || !dropoff || pickup.id === dropoff.id) {
    return { placeId, destinationName, legs: [{ kind: 'bike', to: destination, toName: destinationName }] };
  }
  const legs: JourneyLeg[] = [
    {
      kind: 'walk',
      to: pickup.location,
      toName: `la station V’Lille ${pickup.name}`,
      estimateSeconds: pickup.walkMinutes * 60,
      note: plural(pickup.bikes, 'vélo') + ' disponible' + (pickup.bikes > 1 ? 's' : ''),
    },
    {
      kind: 'bike',
      to: dropoff.location,
      toName: `la station V’Lille ${dropoff.name}`,
      note: plural(dropoff.docks, 'place') + ' libre' + (dropoff.docks > 1 ? 's' : ''),
    },
  ];
  if (dropoff.distanceMeters > 30) {
    legs.push({ kind: 'walk', to: destination, toName: destinationName, estimateSeconds: dropoff.walkMinutes * 60 });
  }
  return { placeId, destinationName, legs };
}

/** Distance à partir de laquelle une étape est terminée. */
const DONE_METERS = { walk: 25, bike: 35, ride: 90 } as const;

export function legEnd(leg: JourneyLeg): LatLng {
  return leg.kind === 'ride' ? leg.to.location : leg.to;
}

export function legDone(leg: JourneyLeg, position: LatLng): boolean {
  return haversineMeters(position, legEnd(leg)) < DONE_METERS[leg.kind];
}

export function lineName(line: TransitLineInfo): string {
  return `${line.vehicle === 'Bus' ? 'le bus' : line.vehicle === 'Tram' ? 'le tram' : 'le métro'} ${line.short}`;
}

export interface RideStatus {
  phase: 'waiting' | 'riding' | 'getoff';
  title: string;
  subtitle: string;
}

/** Où en est l'utilisateur sur une étape en bus / métro / tram. */
export function rideStatus(leg: RideLeg, position: LatLng | null, now: Date, realtimeWait?: number): RideStatus {
  const atStart = position ? haversineMeters(position, leg.from.location) < 120 : true;
  const toEnd = position ? haversineMeters(position, leg.to.location) : Infinity;
  // « Descendez » vers le dernier tiers du trajet (bus aux arrêts rapprochés), 500 m au plus.
  const length = haversineMeters(leg.from.location, leg.to.location);
  const getOffAt = Math.min(500, Math.max(150, length * 0.3));
  if (toEnd < getOffAt) {
    return { phase: 'getoff', title: 'Descendez au prochain arrêt', subtitle: leg.to.name };
  }
  const wait = realtimeWait ?? minutesUntil(leg.departureTime, now);
  if (atStart && wait >= 0) {
    const when = wait <= 0 ? 'départ imminent' : `dans ${wait} min${realtimeWait !== undefined ? ' (temps réel)' : ''}`;
    return {
      phase: 'waiting',
      title: `Prenez ${lineName(leg.line)}`,
      subtitle: `Direction ${leg.headsign} · ${when}`,
    };
  }
  return {
    phase: 'riding',
    title: `Restez dans ${lineName(leg.line)}`,
    subtitle: `Descendez à ${leg.to.name} · ${plural(leg.stopCount, 'arrêt')} · vers ${formatClock(leg.arrivalTime)}`,
  };
}

/** Phrase dite au début d'une étape. */
export function legIntro(leg: JourneyLeg, now: Date, realtimeWait?: number): string {
  if (leg.kind === 'ride') {
    const wait = realtimeWait ?? minutesUntil(leg.departureTime, now);
    const when = wait <= 0 ? 'Il arrive.' : `Départ dans ${plural(wait, 'minute')}.`;
    return `Prenez ${lineName(leg.line)} direction ${leg.headsign}. ${when}`;
  }
  const verb = leg.kind === 'bike' ? 'Pédalez' : 'Marchez';
  return `${verb} jusqu’à ${leg.toName}.${leg.note ? ` ${leg.note}.` : ''}`;
}

/** Phrase dite en arrivant au bout d'une étape (avant d'annoncer la suivante). */
export function legOutro(leg: JourneyLeg, next: JourneyLeg | undefined): string {
  if (!next) return '';
  if (leg.kind === 'ride') return `Descendez à ${leg.to.name}.`;
  if (leg.kind === 'walk' && next.kind === 'bike') return 'Prenez un vélo à la borne.';
  if (leg.kind === 'bike') return 'Déposez votre vélo à la borne.';
  return '';
}

/** Durée restante estimée (s) des étapes APRÈS l'étape en cours. */
export function remainingAfter(legs: JourneyLeg[], index: number, now: Date): number {
  let total = 0;
  for (const leg of legs.slice(index + 1)) {
    if (leg.kind === 'ride') {
      const start = Math.max(now.getTime(), Date.parse(leg.departureTime));
      total += Math.max(0, (Date.parse(leg.arrivalTime) - start) / 1000);
    } else {
      total += leg.estimateSeconds ?? 0;
    }
  }
  return Math.round(total);
}
