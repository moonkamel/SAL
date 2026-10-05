// Stockage des contenus partenaires.
// - Par défaut : fichiers JSON versionnés dans server/ (lecture seule, redéploiement
//   nécessaire pour les modifier).
// - Si SUPABASE_URL et SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) sont définies : base Supabase
//   (tables « content » et « clicks », voir supabase/schema.sql), modifiable depuis
//   l'espace partenaires /admin sans redéployer.

import affiliatesFile from './affiliates.json';
import { TtlCache } from './cache';
import eventsFile from './events.json';
import offersFile from './offers.json';
import { type ContentKind, type ContentTypes, validItems } from './schemas';
import sponsoredFile from './sponsored.json';

const FILES: Record<ContentKind, unknown> = {
  sponsored: sponsoredFile,
  affiliates: affiliatesFile,
  offers: offersFile,
  events: eventsFile,
};

export class StoreError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface SupabaseConfig {
  url: string;
  key: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  // Nouvelle clé secrète (sb_secret_…) ou ancienne clé « service_role ».
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function hasDatabase(): boolean {
  return supabaseConfig() !== null;
}

async function supabase(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response> {
  const cfg = supabaseConfig();
  if (!cfg) throw new StoreError('Base de données non configurée (voir README)', 503);
  const headers: Record<string, string> = { apikey: cfg.key, 'Content-Type': 'application/json' };
  // Les nouvelles clés (sb_secret_…) ne sont pas des JWT : en-tête apikey seul.
  if (!cfg.key.startsWith('sb_')) headers.Authorization = `Bearer ${cfg.key}`;
  if (init.prefer) headers.Prefer = init.prefer;
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/rest/v1/${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new StoreError('Base de données injoignable', 502);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[content] Supabase', res.status, body);
    // Détail de Supabase (code et message, jamais la clé) pour savoir quoi corriger.
    let detail = '';
    try {
      const e = JSON.parse(body) as { code?: string; message?: string };
      detail = [e.code, e.message].filter(Boolean).join(' : ');
    } catch {
      detail = body.slice(0, 120);
    }
    throw new StoreError(`Erreur de la base de données (${res.status}${detail ? ` · ${detail}` : ''})`, 502);
  }
  return res;
}

// Les contenus changent rarement : une minute de cache évite une requête par recherche.
const cache = new TtlCache<unknown[]>(60_000, 10);

/** Données brutes (non validées) d'un type de contenu. */
export async function listRaw(kind: ContentKind): Promise<unknown[]> {
  const hit = cache.get(kind);
  if (hit) return hit;
  let items: unknown[];
  if (hasDatabase()) {
    const res = await supabase(`content?kind=eq.${kind}&select=data&order=id.asc`);
    items = ((await res.json()) as { data: unknown }[]).map((row) => row.data);
  } else {
    items = Array.isArray(FILES[kind]) ? (FILES[kind] as unknown[]) : [];
  }
  cache.set(kind, items);
  return items;
}

/** Contenus valides, prêts à l'emploi. En cas de panne de la base : liste vide. */
export async function getContent<K extends ContentKind>(kind: K): Promise<ContentTypes[K][]> {
  try {
    return validItems(kind, await listRaw(kind));
  } catch (error) {
    console.error(`[content] lecture ${kind} impossible`, error);
    return [];
  }
}

export async function putContent(kind: ContentKind, id: string, data: unknown): Promise<void> {
  await supabase('content?on_conflict=kind,id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify([{ kind, id, data, updated_at: new Date().toISOString() }]),
  });
  invalidate(kind);
}

export async function deleteContent(kind: ContentKind, id: string): Promise<void> {
  await supabase(`content?kind=eq.${kind}&id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  invalidate(kind);
}

export function invalidate(kind?: ContentKind): void {
  if (kind) cache.delete(kind);
  else cache.clear();
}

// --- Statistiques de clics (liens partenaires) ---

export async function recordClick(click: { partner: string; placeId: string }): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await supabase('clicks', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify([{ partner: click.partner, place_id: click.placeId }]),
    });
  } catch (error) {
    // Un clic non compté ne doit jamais bloquer la redirection.
    console.error('[content] clic non enregistré', error);
  }
}

export interface ClickStat {
  partner: string;
  placeId: string;
  clicks: number;
}

/** Clics des `days` derniers jours, par partenaire et par lieu. */
export async function clickStats(days = 30, now: Date = new Date()): Promise<ClickStat[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const res = await supabase(
    `clicks?select=partner,place_id&created_at=gte.${encodeURIComponent(since)}&limit=50000`,
  );
  const rows = (await res.json()) as { partner: string; place_id: string }[];
  const counts = new Map<string, ClickStat>();
  for (const r of rows) {
    const key = `${r.partner}|${r.place_id}`;
    const stat = counts.get(key) ?? { partner: r.partner, placeId: r.place_id, clicks: 0 };
    stat.clicks += 1;
    counts.set(key, stat);
  }
  return [...counts.values()].sort((a, b) => b.clicks - a.clicks);
}
