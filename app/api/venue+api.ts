import { parseLatLng } from '@/server/params';
import { findVenuePlaceId, PlacesError } from '@/server/places';
import { rateLimited } from '@/server/rateLimit';
import { tx } from '@/shared/i18n';

/**
 * GET /api/venue?name=Le Splendid&near=lat,lng&address=…
 * → { placeId } : fiche Google de la salle (onglet « Avis » d'un événement).
 */
export async function GET(request: Request): Promise<Response> {
  const limited = rateLimited('venue', request);
  if (limited) return limited;
  const q = new URL(request.url).searchParams;
  const name = q.get('name')?.trim();
  const near = parseLatLng(q.get('near'));
  if (!name || name.length > 150 || !near) {
    return Response.json({ error: tx('Paramètres invalides') }, { status: 400 });
  }
  try {
    const placeId = await findVenuePlaceId(name, near, q.get('address')?.slice(0, 200) || undefined);
    return Response.json({ placeId }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ placeId: null }, { status });
  }
}
