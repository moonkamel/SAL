import { stopDepartures } from '@/server/ilevia';
import { PlacesError } from '@/server/places';

/** GET /api/transit?stop=Rihour → prochains passages Ilévia en temps réel à cet arrêt. */
export async function GET(request: Request): Promise<Response> {
  const stop = (new URL(request.url).searchParams.get('stop') ?? '').trim().slice(0, 80);
  if (!stop) return Response.json({ error: 'Arrêt manquant' }, { status: 400 });

  try {
    return Response.json(await stopDepartures(stop));
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ error: 'Horaires Ilévia indisponibles' }, { status });
  }
}
