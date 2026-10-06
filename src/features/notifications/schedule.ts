// Calculs des notifications (fonctions pures, testées) : dates des envois et textes.

import { type Lang, translate } from '@/shared/i18n';
import type { AgendaEvent } from '@/shared/types';

/** Prochaines occurrences d'un jour de la semaine à heure fixe (heure du téléphone). */
export function nextWeekdays(now: Date, weekdays: number[], hour: number, minute: number, count: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; out.length < count && i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
    if (weekdays.includes(d.getDay()) && d > now) out.push(d);
  }
  return out;
}

/** Vendredi 17 h 45 : le programme du week-end. */
export const WEEKEND_AT = { weekday: 5, hour: 17, minute: 45 };
/** Mardi et jeudi 17 h : les bons plans de l'afterwork. */
export const AFTERWORK_AT = { weekdays: [2, 4], hour: 17, minute: 0 };

/**
 * Rappel d'un événement : 2 h avant ; s'il commence plus tôt, 30 min avant ;
 * rien s'il commence dans moins de 10 minutes (ou est déjà en cours).
 */
export function reminderTime(start: Date, now: Date): Date | null {
  const twoHours = new Date(start.getTime() - 2 * 3_600_000);
  if (twoHours.getTime() - now.getTime() > 5 * 60_000) return twoHours;
  const half = new Date(start.getTime() - 30 * 60_000);
  if (half.getTime() - now.getTime() > 60_000) return half;
  return null;
}

/** Texte du vendredi : les sorties à la une puis les plus proches. */
export function weekendDigest(events: AgendaEvent[], lang: Lang): { title: string; body: string } {
  const title = translate(lang, 'Ce week-end à Lille');
  if (!events.length) return { title, body: translate(lang, 'Concerts, expos, soirées : le programme du week-end est prêt.') };
  const picks = [...events]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.distanceMeters - b.distanceMeters)
    .slice(0, 2)
    .map((e) => e.title);
  const others = events.length - picks.length;
  return {
    title,
    body:
      others > 1
        ? translate(lang, '{picks} et {n} autres sorties près de chez vous.', { picks: picks.join(', '), n: others })
        : others === 1
          ? translate(lang, '{picks} et une autre sortie près de chez vous.', { picks: picks.join(', ') })
          : translate(lang, '{picks} : à ne pas manquer.', { picks: picks.join(', ') }),
  };
}
