import { TtlCache } from '@/server/cache';
import { parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';
import { computeAllRoutes } from '@/server/routes';
import type { RouteOption, RouteResponse } from '@/shared/types';

const cache = new TtlCache<RouteOption[]>(5 * 60 * 1000, 500);

/** GET /api/route?from=lat,lng&to=lat,lng → itinéraires marche, vélo, voiture, transports. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const from = parseLatLng(url.searchParams.get('from'));
  const to = parseLatLng(url.searchParams.get('to'));
  if (!from || !to) {
    return Response.json({ error: 'Paramètres d’itinéraire invalides' }, { status: 400 });
  }

  // ~10 m de précision sur le départ : suffisant pour un aperçu, et le cache sert davantage.
  const key = [from.lat.toFixed(4), from.lng.toFixed(4), to.lat.toFixed(5), to.lng.toFixed(5)].join(
    ',',
  );
  try {
    let options = cache.get(key);
    if (!options) {
      options = await computeAllRoutes(from, to);
      cache.set(key, options);
    }
    return Response.json({ options } satisfies RouteResponse);
  } catch (error) {
    if (error instanceof PlacesError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/route]', error);
    return Response.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
