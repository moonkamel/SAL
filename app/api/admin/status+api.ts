import { requireAdmin } from '@/server/admin';
import { openAgendaConfig } from '@/server/agenda';
import { usageStats } from '@/server/analytics';
import { clickStats, hasDatabase, StoreError } from '@/server/content';

/** GET /api/admin/status?days=30 → configuration, clics partenaires et statistiques d'usage. */
export async function GET(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const database = hasDatabase();
  let clicks: Awaited<ReturnType<typeof clickStats>> = [];
  let clicksError: string | undefined;
  let usage: Awaited<ReturnType<typeof usageStats>> | undefined;
  let usageError: string | undefined;
  if (database) {
    const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 30));
    const [c, u] = await Promise.allSettled([clickStats(30), usageStats(days)]);
    if (c.status === 'fulfilled') clicks = c.value;
    else clicksError = c.reason instanceof StoreError ? c.reason.message : 'Statistiques indisponibles';
    if (u.status === 'fulfilled') usage = u.value;
    else usageError = u.reason instanceof StoreError ? u.reason.message : 'Statistiques indisponibles';
  }
  return Response.json({
    database,
    openAgenda: openAgendaConfig() !== null,
    clicks,
    clicksError,
    usage,
    usageError,
  });
}
