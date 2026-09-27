import { useSyncExternalStore } from 'react';

// Indique si un guidage est en cours. La publicité (étape 5) le consulte :
// aucune annonce ne doit s'afficher pendant la navigation active.
let guiding = false;
const listeners = new Set<() => void>();

export function setGuidanceActive(active: boolean): void {
  if (guiding === active) return;
  guiding = active;
  listeners.forEach((l) => l());
}

export function isGuidanceActive(): boolean {
  return guiding;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGuidanceActive(): boolean {
  return useSyncExternalStore(subscribe, isGuidanceActive, isGuidanceActive);
}
