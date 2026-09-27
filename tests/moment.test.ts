import { describe, expect, it } from 'vitest';

import { momentLabel, momentOfDay } from '@/src/lib/moment';

describe('momentLabel', () => {
  it('donne le jour et le moment', () => {
    expect(momentLabel(new Date(2026, 8, 26, 21, 0))).toBe('SAMEDI SOIR · LILLE');
    expect(momentLabel(new Date(2026, 8, 27, 12, 30))).toBe('DIMANCHE MIDI · LILLE');
  });

  it('rattache la nuit à la veille', () => {
    expect(momentLabel(new Date(2026, 8, 27, 2, 0))).toBe('SAMEDI NUIT · LILLE');
  });

  it('découpe la journée', () => {
    expect(momentOfDay(8)).toBe('MATIN');
    expect(momentOfDay(16)).toBe('APRÈS-MIDI');
    expect(momentOfDay(23)).toBe('SOIR');
  });
});
