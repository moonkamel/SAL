import type { Journey } from '@/shared/journey';

// Voyage à lancer : passé à l'écran /journey sans le sérialiser dans l'adresse.
let pending: Journey | null = null;

export function setPendingJourney(journey: Journey): void {
  pending = journey;
}

export function takePendingJourney(): Journey | null {
  return pending;
}
