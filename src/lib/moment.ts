// Petit libellé contextuel de l'accueil : « SAMEDI SOIR · LILLE ».

import { type Lang, translate, tx } from '@/shared/i18n';
import type { AgendaWhen } from '@/shared/types';

const DAYS = [
  tx('DIMANCHE'),
  tx('LUNDI'),
  tx('MARDI'),
  tx('MERCREDI'),
  tx('JEUDI'),
  tx('VENDREDI'),
  tx('SAMEDI'),
];

export function momentOfDay(hour: number): string {
  if (hour < 5) return tx('NUIT');
  if (hour < 11) return tx('MATIN');
  if (hour < 14) return tx('MIDI');
  if (hour < 18) return tx('APRÈS-MIDI');
  return tx('SOIR');
}

export function momentLabel(date: Date = new Date(), lang: Lang = 'fr'): string {
  // Après minuit, on est encore « vendredi soir / nuit » pour sortir.
  const hour = date.getHours();
  const day = hour < 5 ? (date.getDay() + 6) % 7 : date.getDay();
  return translate(lang, '{day} {moment} · LILLE', {
    day: translate(lang, DAYS[day]!),
    moment: translate(lang, momentOfDay(hour)),
  });
}

/** Journée (6 h – 19 h) : « On fait quoi aujourd'hui ? » et accueil en tonalité jour. */
export function isDaytime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 6 && hour < 19;
}

/**
 * Périodes proposées dans l'agenda. Le dimanche, « cette semaine » et « ce week-end »
 * se résument à aujourd'hui : on propose plutôt la semaine prochaine.
 */
export function agendaPeriods(date: Date = new Date()): AgendaWhen[] {
  // Avant 6 h, on est encore dans la soirée de la veille.
  const day = date.getHours() < 6 ? (date.getDay() + 6) % 7 : date.getDay();
  return day === 0 ? ['today', 'tomorrow', 'nextweek'] : ['today', 'tomorrow', 'week', 'weekend'];
}
