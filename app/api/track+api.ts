import { recordEvents, TrackBody } from '@/server/analytics';
import { rateLimited } from '@/server/rateLimit';

/** POST /api/track : statistiques d'usage anonymes (voir server/analytics.ts). */
export async function POST(request: Request): Promise<Response> {
  const limited = rateLimited('track', request);
  if (limited) return limited;
  const parsed = TrackBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  try {
    await recordEvents(parsed.data);
  } catch (error) {
    // Une statistique perdue ne doit jamais gêner l'app.
    console.error('[track]', error);
  }
  return new Response(null, { status: 204 });
}
