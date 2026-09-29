import { rateLimited } from '@/server/rateLimit';
import { isNearLille, parseLatLng } from '@/server/params';
import { PlacesError } from '@/server/places';
import { surprise } from '@/server/surprise';
import { langFromHeader, tx } from '@/shared/i18n';

/** GET /api/surprise?near=lat,lng → un lieu ouvert, bien noté et proche, tiré au sort. */
export async function GET(request: Request): Promise<Response> {
  const limited = rateLimited('surprise', request);
  if (limited) return limited;
  const near = parseLatLng(new URL(request.url).searchParams.get('near'));
  if (!near) return Response.json({ error: tx('Position invalide') }, { status: 400 });
  if (!isNearLille(near)) {
    return Response.json({ error: tx('Surprends-moi fonctionne dans la métropole lilloise.') }, { status: 422 });
  }

  try {
    const result = await surprise(near, { lang: langFromHeader(request.headers.get('accept-language')) });
    if (!result) {
      return Response.json(
        { error: tx('Rien d’ouvert et bien noté tout près pour le moment. Réessayez un peu plus tard !') },
        { status: 404 },
      );
    }
    return Response.json(result);
  } catch (error) {
    console.error('[surprise]', error);
    const status = error instanceof PlacesError ? error.status : 500;
    return Response.json({ error: tx('Surprise impossible pour le moment. Réessayez.') }, { status });
  }
}
