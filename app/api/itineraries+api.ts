import { transitItineraries } from '@/server/itineraries';
import { isNearLille, parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';
import { rateLimited } from '@/server/rateLimit';
import type { ItinerariesResponse } from '@/shared/types';

/** GET /api/itineraries?from=lat,lng&to=lat,lng&name=… → trajets détaillés en transports. */
export async function GET(request: Request): Promise<Response> {
  const limited = rateLimited('route', request);
  if (limited) return limited;
  const q = new URL(request.url).searchParams;
  const from = parseLatLng(q.get('from'));
  const to = parseLatLng(q.get('to'));
  const name = (q.get('name') ?? 'Destination').slice(0, 100);
  if (!from || !to) return Response.json({ error: 'Positions invalides' }, { status: 400 });
  if (!isNearLille(to)) return Response.json({ itineraries: [] });

  try {
    const body: ItinerariesResponse = { itineraries: await transitItineraries(from, to, name) };
    return Response.json(body);
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    const message = error instanceof PlacesError ? error.message : 'Erreur interne';
    return Response.json({ error: message }, { status });
  }
}
