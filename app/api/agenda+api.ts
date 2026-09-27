import { agenda } from '@/server/agenda';
import { parseLatLng } from '@/server/params';
import type { AgendaResponse, AgendaWhen } from '@/shared/types';

const WHEN: AgendaWhen[] = ['today', 'tomorrow', 'weekend'];

/** GET /api/agenda?near=lat,lng&when=today|tomorrow|weekend */
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const near = parseLatLng(q.get('near'));
  const when = (q.get('when') ?? 'today') as AgendaWhen;
  if (!near || !WHEN.includes(when)) {
    return Response.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  try {
    const body: AgendaResponse = { events: await agenda(near, when) };
    return Response.json(body);
  } catch (error) {
    console.error('[api/agenda]', error);
    return Response.json({ error: 'Agenda momentanément indisponible' }, { status: 500 });
  }
}
