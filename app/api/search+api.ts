import { PlacesError } from '@/server/places';
import { search, SearchRequestSchema } from '@/server/search';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Paramètres de recherche invalides' }, { status: 400 });
  }

  try {
    return Response.json(await search(parsed.data));
  } catch (error) {
    if (error instanceof PlacesError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/search]', error);
    return Response.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
