import { agenda, type AgendaDebug } from '@/server/agenda';
import { parseLatLng } from '@/server/params';
import type { AgendaResponse, AgendaWhen } from '@/shared/types';
import { langFromHeader, tx } from '@/shared/i18n';

const WHEN: AgendaWhen[] = ['today', 'tomorrow', 'weekend'];

/** GET /api/agenda?near=lat,lng&when=today|tomorrow|weekend */
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const near = parseLatLng(q.get('near'));
  const when = (q.get('when') ?? 'today') as AgendaWhen;
  if (!near || !WHEN.includes(when)) {
    return Response.json({ error: tx('Paramètres invalides') }, { status: 400 });
  }
  try {
    const lang = langFromHeader(request.headers.get('accept-language'));
    const debug: AgendaDebug | undefined =
      q.get('debug') === '1'
        ? { window: { start: '', end: '' }, partnerEvents: 0, openAgendaKey: false, agendas: [] }
        : undefined;
    const body: AgendaResponse = { events: await agenda(near, when, new Date(), lang, debug) };
    return Response.json(debug ? { ...body, debug } : body);
  } catch (error) {
    console.error('[api/agenda]', error);
    return Response.json({ error: tx('Agenda momentanément indisponible') }, { status: 500 });
  }
}
