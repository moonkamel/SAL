// Statistiques d'usage anonymes : recherches, écrans vus, itinéraires… stockées
// dans la base Supabase (table « events »). Aucune donnée personnelle : pas
// d'identifiant d'appareil ni de compte, seulement un numéro de session tiré au
// hasard à chaque ouverture de l'app.

import { z } from 'zod';

import { hasDatabase, supabaseRequest } from './content';

export const EVENT_NAMES = [
  'app_open',
  'screen',
  'search',
  'sort',
  'open_now',
  'directions',
  'ticket',
  'share',
  'reminder',
  'notifications',
] as const;

const PropValue = z.union([z.string().max(80), z.number().finite(), z.boolean()]);

export const TrackBody = z.object({
  session: z.string().regex(/^[a-z0-9]{8,32}$/),
  lang: z.string().max(5),
  platform: z.enum(['android', 'ios', 'web']),
  version: z.string().max(20).optional(),
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        props: z.record(z.string().max(30), PropValue).optional(),
        /** Horodatage de l'appareil (ms) : sert à l'ordre des écrans dans la session. */
        t: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(50),
});

export type TrackBody = z.infer<typeof TrackBody>;

export async function recordEvents(body: TrackBody): Promise<void> {
  if (!hasDatabase()) return;
  const now = Date.now();
  const rows = body.events.map((e) => ({
    name: e.name,
    props: { ...e.props, lang: body.lang, platform: body.platform, ...(body.version ? { v: body.version } : {}) },
    session: body.session,
    // Une horloge d'appareil fausse ne doit pas placer l'événement hors de la journée.
    created_at: new Date(Math.abs(e.t - now) < 6 * 3_600_000 ? e.t : now).toISOString(),
  }));
  await supabaseRequest('events', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(rows),
  });
  // De temps en temps, on efface ce qui a plus de 13 mois (politique de confidentialité).
  if (Math.random() < 0.01) {
    const limit = new Date(now - RETENTION_DAYS * 86_400_000).toISOString();
    await supabaseRequest(`events?created_at=lt.${encodeURIComponent(limit)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    }).catch((error) => console.error('[track] nettoyage', error));
  }
}

/** Durée de conservation des statistiques (13 mois). */
export const RETENTION_DAYS = 395;

export interface EventRow {
  name: string;
  props: Record<string, string | number | boolean> | null;
  session: string;
  created_at: string;
}

export interface UsageStats {
  days: number;
  sessions: number;
  /** Sessions par jour (AAAA-MM-JJ), du plus ancien au plus récent. */
  perDay: { day: string; sessions: number }[];
  languages: { lang: string; sessions: number }[];
  screens: { screen: string; views: number }[];
  searches: { query: string; count: number; avgResults: number }[];
  /** Recherches sans aucun résultat : ce que les gens cherchent et ne trouvent pas. */
  emptySearches: { query: string; count: number }[];
  /** Parcours : ouverture → recherche → fiche d'un lieu → itinéraire / billetterie. */
  funnel: { step: string; sessions: number }[];
  /** Dernier écran vu avant de quitter l'app. */
  exits: { screen: string; sessions: number }[];
  directions: { mode: string; count: number }[];
}

const top = <T>(map: Map<string, T>, value: (v: T) => number, limit: number) =>
  [...map.entries()].sort((a, b) => value(b[1]) - value(a[1])).slice(0, limit);

/** Tableau de bord à partir des événements bruts (fonction pure, testée). */
export function computeUsage(rows: EventRow[], days: number): UsageStats {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sessions = new Map<string, EventRow[]>();
  for (const r of sorted) {
    const list = sessions.get(r.session) ?? [];
    list.push(r);
    sessions.set(r.session, list);
  }

  const perDay = new Map<string, Set<string>>();
  const languages = new Map<string, number>();
  const screens = new Map<string, number>();
  const searches = new Map<string, { count: number; results: number }>();
  const empty = new Map<string, number>();
  const exits = new Map<string, number>();
  const directions = new Map<string, number>();
  const funnel = { opened: 0, searched: 0, place: 0, went: 0 };

  for (const [session, events] of sessions) {
    const first = events[0]!;
    const day = first.created_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? new Set()).add(session));
    const lang = String(first.props?.lang ?? '?');
    languages.set(lang, (languages.get(lang) ?? 0) + 1);

    let searched = false;
    let place = false;
    let went = false;
    let lastScreen: string | undefined;
    for (const e of events) {
      const p = e.props ?? {};
      if (e.name === 'screen' && typeof p.screen === 'string') {
        screens.set(p.screen, (screens.get(p.screen) ?? 0) + 1);
        lastScreen = p.screen;
        if (p.screen === '/place/[id]' || p.screen === '/event/[id]') place = true;
      } else if (e.name === 'search' && typeof p.q === 'string') {
        searched = true;
        const q = p.q.toLowerCase().trim();
        const n = typeof p.n === 'number' ? p.n : 0;
        const s = searches.get(q) ?? { count: 0, results: 0 };
        s.count += 1;
        s.results += n;
        searches.set(q, s);
        if (n === 0) empty.set(q, (empty.get(q) ?? 0) + 1);
      } else if (e.name === 'directions') {
        went = true;
        const mode = String(p.mode ?? '?');
        directions.set(mode, (directions.get(mode) ?? 0) + 1);
      } else if (e.name === 'ticket') {
        went = true;
      }
    }
    funnel.opened += 1;
    if (searched) funnel.searched += 1;
    if (place) funnel.place += 1;
    if (went) funnel.went += 1;
    if (lastScreen) exits.set(lastScreen, (exits.get(lastScreen) ?? 0) + 1);
  }

  return {
    days,
    sessions: sessions.size,
    perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, s]) => ({ day, sessions: s.size })),
    languages: top(languages, (v) => v, 10).map(([lang, n]) => ({ lang, sessions: n })),
    screens: top(screens, (v) => v, 15).map(([screen, views]) => ({ screen, views })),
    searches: top(searches, (v) => v.count, 30).map(([query, v]) => ({
      query,
      count: v.count,
      avgResults: Math.round(v.results / v.count),
    })),
    emptySearches: top(empty, (v) => v, 15).map(([query, count]) => ({ query, count })),
    funnel: [
      { step: 'Ouverture de l’app', sessions: funnel.opened },
      { step: 'Recherche', sessions: funnel.searched },
      { step: 'Fiche d’un lieu ou d’un événement', sessions: funnel.place },
      { step: 'Itinéraire ou billetterie', sessions: funnel.went },
    ],
    exits: top(exits, (v) => v, 10).map(([screen, n]) => ({ screen, sessions: n })),
    directions: top(directions, (v) => v, 10).map(([mode, count]) => ({ mode, count })),
  };
}

/** Statistiques des `days` derniers jours (au plus 100 000 événements). */
export async function usageStats(days = 30, now: Date = new Date()): Promise<UsageStats> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const res = await supabaseRequest(
    `events?select=name,props,session,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=100000`,
  );
  return computeUsage((await res.json()) as EventRow[], days);
}
