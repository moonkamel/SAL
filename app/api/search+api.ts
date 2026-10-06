import { rateLimited } from '@/server/rateLimit';
import { PlacesError } from '@/server/places';
import { search, SearchRequestSchema } from '@/server/search';
import { langFromHeader, tx } from '@/shared/i18n';

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimited('search', request);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: tx('Requête invalide') }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: tx('Paramètres de recherche invalides') }, { status: 400 });
  }

  try {
    return Response.json(await search(parsed.data, langFromHeader(request.headers.get('accept-language'))));
  } catch (error) {
    if (error instanceof PlacesError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/search]', error);
    return Response.json({ error: tx('Erreur interne') }, { status: 500 });
  }
}
