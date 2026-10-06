import { describe, expect, it } from 'vitest';

import { nextWeekdays, reminderTime, weekendDigest } from '@/src/features/notifications/schedule';
import type { AgendaEvent } from '@/shared/types';

describe('notifications', () => {
  it('prochains vendredis 17 h 45, sans celui déjà passé', () => {
    const fridayEvening = new Date(2026, 9, 9, 18, 0); // vendredi 9 octobre, 18 h
    const dates = nextWeekdays(fridayEvening, [5], 17, 45, 2);
    expect(dates.map((d) => [d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [16, 17, 45],
      [23, 17, 45],
    ]);
    const monday = new Date(2026, 9, 5, 12, 0);
    expect(nextWeekdays(monday, [2, 4], 17, 0, 3).map((d) => d.getDate())).toEqual([6, 8, 13]);
  });

  it('rappel 2 h avant, sinon 30 min avant, sinon rien', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    expect(reminderTime(new Date('2026-10-05T18:00:00Z'), now)?.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(reminderTime(new Date('2026-10-05T13:00:00Z'), now)?.toISOString()).toBe('2026-10-05T12:30:00.000Z');
    expect(reminderTime(new Date('2026-10-05T12:20:00Z'), now)).toBeNull();
  });

  it('résume le week-end : à la une, puis les plus proches', () => {
    const e = (id: string, featured: boolean, d: number) =>
      ({ id, title: id, featured, distanceMeters: d }) as AgendaEvent;
    const digest = weekendDigest([e('Expo loin', false, 3000), e('Concert près', false, 200), e('Soirée partenaire', true, 900)], 'fr');
    expect(digest.title).toBe('Ce week-end à Lille');
    expect(digest.body).toBe('Soirée partenaire, Concert près et une autre sortie près de chez vous.');
  });
});
