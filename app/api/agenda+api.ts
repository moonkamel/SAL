import { agenda, type AgendaDebug } from '@/server/agenda';
import { parseLatLng } from '@/server/params';
import type { AgendaResponse, AgendaWhen } from '@/shared/types';
import { isLang, langFromHeader, tx } from '@/shared/i18n';
import { autoTranslate, isAutoTranslateEnabled, lastTranslateError } from '@/server/autoTranslate';

const WHEN: AgendaWhen[] = ['today', 'tomorrow', 'week', 'weekend', 'nextweek'];

/** GET /api/agenda?near=lat,lng&when=today|tomorrow|week|weekend|nextweek */
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const near = parseLatLng(q.get('near'));
  const when = (q.get('when') ?? 'today') as AgendaWhen;
  if (!near || !WHEN.includes(when)) {
    return Response.json({ error: tx('Paramètres invalides') }, { status: 400 });
  }
  try {
    // ?lang=nl : utile pour tester une langue depuis le navigateur.
    const forced = q.get('lang');
    const lang = isLang(forced) ? forced : langFromHeader(request.headers.get('accept-language'));
    const debug: AgendaDebug | undefined =
      q.get('debug') === '1'
        ? { window: { start: '', end: '' }, partnerEvents: 0, openAgendaKey: false, agendas: [] }
        : undefined;
    const body: AgendaResponse = { events: await agenda(near, when, new Date(), lang, debug, new URL(request.url).origin) };
    if (debug && lang !== 'fr') {
      // Essai de traduction en direct : dit tout de suite si la clé et le modèle répondent.
      const [probe] = await autoTranslate([`Soirée karaoké ce soir (${Date.now() % 1000})`], lang);
      debug.translate = {
        enabled: isAutoTranslateEnabled(),
        lang,
        probe,
        lastError: lastTranslateError,
      };
    }
    return Response.json(debug ? { ...body, debug } : body);
  } catch (error) {
    console.error('[api/agenda]', error);
    return Response.json({ error: tx('Agenda momentanément indisponible') }, { status: 500 });
  }
}
