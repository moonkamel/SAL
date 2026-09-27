import { describe, expect, it } from 'vitest';

import { isGuidanceActive, setGuidanceActive } from '@/src/features/navigation/guidanceState';
import {
  isGuidable,
  routeErrorMessage,
  sessionErrorMessage,
} from '@/src/features/navigation/messages';

describe('messages du guidage', () => {
  it('traduit les statuts de session du SDK', () => {
    expect(sessionErrorMessage('notAuthorized')).toContain('Navigation SDK');
    expect(sessionErrorMessage('networkError')).toContain('connexion');
    expect(sessionErrorMessage('inconnu')).toBe('Le guidage n’a pas pu démarrer. Réessayez.');
  });

  it('traduit les statuts d’itinéraire du SDK', () => {
    expect(routeErrorMessage('NO_ROUTE_FOUND')).toContain('Aucun itinéraire');
    expect(routeErrorMessage('LOCATION_UNKNOWN')).toContain('position');
    expect(routeErrorMessage('UNKNOWN')).toBe('L’itinéraire n’a pas pu être calculé. Réessayez.');
  });

  it('exclut les transports en commun du guidage', () => {
    expect(isGuidable('walk')).toBe(true);
    expect(isGuidable('bicycle')).toBe(true);
    expect(isGuidable('drive')).toBe(true);
    expect(isGuidable('transit')).toBe(false);
  });
});

describe('état du guidage (utilisé pour couper la publicité)', () => {
  it('suit le démarrage et l’arrêt', () => {
    expect(isGuidanceActive()).toBe(false);
    setGuidanceActive(true);
    expect(isGuidanceActive()).toBe(true);
    setGuidanceActive(false);
    expect(isGuidanceActive()).toBe(false);
  });
});
