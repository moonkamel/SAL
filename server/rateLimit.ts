// Limite simple du nombre d'appels par adresse IP, pour protéger le quota Google
// (un robot ou un bug qui boucle ne doit pas vider le budget).
// Mémoire locale à chaque instance du serveur : c'est un garde-fou, pas une garantie.
// La vraie limite dure se règle dans Google Cloud (quotas par jour, voir README).

import { tx } from '@/shared/i18n';

interface Bucket {
  count: number;
  resetAt: number;
}

export const LIMITS = {
  search: { max: 30, windowMs: 60_000 },
  surprise: { max: 10, windowMs: 60_000 },
  place: { max: 60, windowMs: 60_000 },
  photo: { max: 240, windowMs: 60_000 },
  venue: { max: 30, windowMs: 60_000 },
  route: { max: 30, windowMs: 60_000 },
  admin: { max: 60, windowMs: 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

const buckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'local'
  );
}

/** Vrai si l'appel est autorisé ; compte l'appel au passage. */
export function allow(name: LimitName, key: string, now: number = Date.now()): boolean {
  const { max, windowMs } = LIMITS[name];
  const id = `${name}|${key}`;
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 10_000) buckets.clear(); // borne la mémoire
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

/** Réponse 429 prête à renvoyer, ou null si l'appel est autorisé. */
export function rateLimited(name: LimitName, request: Request): Response | null {
  if (allow(name, clientIp(request))) return null;
  return Response.json(
    { error: tx('Trop de demandes d’un coup. Patientez une minute et réessayez.') },
    { status: 429, headers: { 'Retry-After': '60' } },
  );
}

export function resetRateLimits(): void {
  buckets.clear();
}
