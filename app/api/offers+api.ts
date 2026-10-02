import { offersNear } from '@/server/offers';
import { parseLatLng } from '@/server/params';
import type { OffersResponse } from '@/shared/types';
import { langFromHeader, tx } from '@/shared/i18n';

/** GET /api/offers?near=lat,lng → bons plans du jour à moins de 5 km. */
export async function GET(request: Request): Promise<Response> {
  const near = parseLatLng(new URL(request.url).searchParams.get('near'));
  if (!near) return Response.json({ error: tx('Position invalide') }, { status: 400 });
  const lang = langFromHeader(request.headers.get('accept-language'));
  const body: OffersResponse = { offers: await offersNear(near, lang) };
  return Response.json(body);
}
