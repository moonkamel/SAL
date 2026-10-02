import { requireAdmin } from '@/server/admin';
import { openAgendaConfig } from '@/server/agenda';
import { clickStats, hasDatabase, StoreError } from '@/server/content';

/** GET /api/admin/status → configuration et clics des 30 derniers jours. */
export async function GET(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const database = hasDatabase();
  let clicks: Awaited<ReturnType<typeof clickStats>> = [];
  let clicksError: string | undefined;
  if (database) {
    try {
      clicks = await clickStats(30);
    } catch (error) {
      clicksError = error instanceof StoreError ? error.message : 'Statistiques indisponibles';
    }
  }
  return Response.json({
    database,
    openAgenda: openAgendaConfig() !== null,
    clicks,
    clicksError,
  });
}
