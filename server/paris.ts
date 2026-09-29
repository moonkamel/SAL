// Dates et heures à Lille (Europe/Paris), quel que soit le fuseau du serveur.

import { type Lang, LANG_INFO } from '@/shared/i18n';

const TZ = 'Europe/Paris';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ParisParts {
  /** AAAA-MM-JJ */
  date: string;
  /** 0 = dimanche … 6 = samedi */
  day: number;
  /** Minutes depuis minuit. */
  minutes: number;
}

export function parisParts(date: Date): ParisParts {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    day: WEEKDAYS[p.weekday!] ?? 0,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Décalage de Paris par rapport à UTC, en minutes (60 l'hiver, 120 l'été). */
export function parisOffsetMinutes(date: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((x) => x.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name ?? '');
  if (!m) return 60;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Instant correspondant à « AAAA-MM-JJ HH:MM » heure de Lille. */
export function parisTime(ymd: string, hour: number, minute = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  let guess = new Date(naive - parisOffsetMinutes(new Date(naive)) * 60_000);
  guess = new Date(naive - parisOffsetMinutes(guess) * 60_000); // changement d'heure
  return guess;
}

/** Ajoute des jours à une date AAAA-MM-JJ. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TZ,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatParisTime = (d: Date) => timeFmt.format(d);
const dayTimeFmts = new Map<Lang, Intl.DateTimeFormat>([['fr', dayTimeFmt]]);

/** « sam. 21:00 » dans la langue demandée (toujours sur 24 h). */
export function formatParisDayTime(d: Date, lang: Lang = 'fr'): string {
  let f = dayTimeFmts.get(lang);
  if (!f) {
    f = new Intl.DateTimeFormat(LANG_INFO[lang].locale, {
      timeZone: TZ,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    dayTimeFmts.set(lang, f);
  }
  return f.format(d);
}
