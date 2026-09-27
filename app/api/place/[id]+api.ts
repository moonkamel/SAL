import { linksFor } from '@/server/affiliates';
import { TtlCache } from '@/server/cache';
import { PlacesError, placeDetails } from '@/server/places';
import type { PlaceDetails } from '@/shared/types';

// Même règle que pour la recherche : quelques minutes en mémoire, rien sur disque.
const cache = new TtlCache<PlaceDetails>(5 * 60 * 1000, 500);

/** GET /api/place/:id?fields=summary|full (full par défaut, avec les avis). */
export async function GET(request: Request, { id }: Record<string, string>): Promise<Response> {
  const mode = new URL(request.url).searchParams.get('fields') === 'summary' ? 'summary' : 'full';
  const key = `${mode}|${id}`;

  try {
    let details = cache.get(key);
    if (!details) {
      details = await placeDetails(id ?? '', mode);
      cache.set(key, details);
    }
    // Liens partenaires calculés à chaque appel : un changement d'affiliates.json
    // s'applique sans attendre l'expiration du cache.
    const partnerLinks = mode === 'full' ? linksFor(details) : [];
    return Response.json(partnerLinks.length ? { ...details, partnerLinks } : details);
  } catch (error) {
    if (error instanceof PlacesError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/place]', error);
    return Response.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
