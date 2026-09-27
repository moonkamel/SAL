import { rateLimited } from '@/server/rateLimit';
import { TtlCache } from '@/server/cache';
import { PlacesError, photoUri } from '@/server/places';

// L'URL googleusercontent renvoyée par Google est temporaire : on la garde
// seulement quelques minutes pour éviter de repayer la même photo à chaque affichage.
const uriCache = new TtlCache<string>(5 * 60 * 1000, 1000);

const ALLOWED_WIDTHS = [200, 400, 800, 1200];

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimited('photo', request);
  if (limited) return limited;
  const url = new URL(request.url);
  const name = url.searchParams.get('name') ?? '';
  const requested = Number(url.searchParams.get('w') ?? 400);
  const width = ALLOWED_WIDTHS.find((w) => w >= requested) ?? 1200;

  const key = `${name}|${width}`;
  try {
    let uri = uriCache.get(key);
    if (!uri) {
      uri = await photoUri(name, width);
      uriCache.set(key, uri);
    }
    return Response.redirect(uri, 302);
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 500;
    return new Response(null, { status });
  }
}
