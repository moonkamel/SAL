import { isNearLille, parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';
import { vlilleNear } from '@/server/vlille';
import { tx } from '@/shared/i18n';

/** GET /api/vlille?near=lat,lng&limit=3 → stations V'Lille les plus proches, en temps réel. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const near = parseLatLng(url.searchParams.get('near'));
  const limit = Math.min(5, Math.max(1, Number(url.searchParams.get('limit') ?? 3) || 3));
  if (!near) return Response.json({ error: tx('Position invalide') }, { status: 400 });
  if (!isNearLille(near)) return Response.json({ stations: [] });

  try {
    return Response.json(await vlilleNear(near, limit));
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ error: tx('Données V’Lille indisponibles') }, { status });
  }
}
