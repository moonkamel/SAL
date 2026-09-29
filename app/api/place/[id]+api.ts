import { rateLimited } from '@/server/rateLimit';
import { activePartners, linksFor } from '@/server/affiliates';
import { translateFields } from '@/server/autoTranslate';
import { TtlCache } from '@/server/cache';
import { offersForPlace } from '@/server/offers';
import { PlacesError, placeDetails } from '@/server/places';
import type { PlaceDetails } from '@/shared/types';
import { langFromHeader, tx } from '@/shared/i18n';

// Même règle que pour la recherche : quelques minutes en mémoire, rien sur disque.
const cache = new TtlCache<PlaceDetails>(5 * 60 * 1000, 500);

/** GET /api/place/:id?fields=summary|full (full par défaut, avec les avis). */
export async function GET(request: Request, { id }: Record<string, string>): Promise<Response> {
  const limited = rateLimited('place', request);
  if (limited) return limited;
  const mode = new URL(request.url).searchParams.get('fields') === 'summary' ? 'summary' : 'full';
  const lang = langFromHeader(request.headers.get('accept-language'));
  const key = `${mode}|${lang}|${id}`;

  try {
    let details = cache.get(key);
    if (!details) {
      details = await placeDetails(id ?? '', mode, lang);
      cache.set(key, details);
    }
    // Liens partenaires calculés à chaque appel : un changement d'affiliates.json
    // s'applique sans attendre l'expiration du cache.
    if (mode === 'summary') return Response.json(details);
    const [partners, offers] = await Promise.all([activePartners(), offersForPlace(details.id, lang)]);
    // Libellés des partenaires (saisis en français) traduits automatiquement.
    const partnerLinks = await translateFields(linksFor(details, partners), ['label'], lang);
    return Response.json({
      ...details,
      ...(partnerLinks.length ? { partnerLinks } : {}),
      ...(offers.length ? { offers } : {}),
    });
  } catch (error) {
    if (error instanceof PlacesError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/place]', error);
    return Response.json({ error: tx('Erreur interne') }, { status: 500 });
  }
}
