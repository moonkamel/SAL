import { describe, expect, it } from 'vitest';

import { isDaytime, momentLabel, momentOfDay } from '@/src/lib/moment';

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

describe('jour ou soir', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m);
  it('« aujourd’hui » de 6 h à 19 h, « ce soir » le reste du temps', () => {
    expect(isDaytime(at(5, 59))).toBe(false);
    expect(isDaytime(at(6))).toBe(true);
    expect(isDaytime(at(13))).toBe(true);
    expect(isDaytime(at(18, 59))).toBe(true);
    expect(isDaytime(at(19))).toBe(false);
    expect(isDaytime(at(23))).toBe(false);
  });
});
