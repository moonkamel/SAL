import { offersNear } from '@/server/offers';
import { parseLatLng } from '@/server/params';
import type { OffersResponse } from '@/shared/types';

/** GET /api/offers?near=lat,lng → bons plans du jour à moins de 5 km. */
export async function GET(request: Request): Promise<Response> {
  const near = parseLatLng(new URL(request.url).searchParams.get('near'));
  if (!near) return Response.json({ error: 'Position invalide' }, { status: 400 });
  const body: OffersResponse = { offers: await offersNear(near) };
  return Response.json(body);
}
