import { transitNear } from '@/server/ilevia';
import { isNearLille, parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';

/** GET /api/transit?near=lat,lng → prochains passages aux arrêts Ilévia les plus proches. */
export async function GET(request: Request): Promise<Response> {
  const near = parseLatLng(new URL(request.url).searchParams.get('near'));
  if (!near) return Response.json({ error: 'Position invalide' }, { status: 400 });
  if (!isNearLille(near)) return Response.json({ stops: [] });

  try {
    return Response.json(await transitNear(near));
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ error: 'Horaires Ilévia indisponibles' }, { status });
  }
}
