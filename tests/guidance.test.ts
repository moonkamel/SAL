import { describe, expect, it } from 'vitest';

import { isGuidanceActive, setGuidanceActive } from '@/src/features/navigation/guidanceState';
describe('état du guidage (utilisé pour couper la publicité)', () => {
  it('suit le démarrage et l’arrêt', () => {
    expect(isGuidanceActive()).toBe(false);
    setGuidanceActive(true);
    expect(isGuidanceActive()).toBe(true);
    setGuidanceActive(false);
    expect(isGuidanceActive()).toBe(false);
  });
});
