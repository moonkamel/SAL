import { activePartners, findPartner, partnerUrl } from '@/server/affiliates';
import { recordClick } from '@/server/content';
import { parseLatLng } from '@/server/params';
import { PLACE_ID_PATTERN } from '@/server/places';
import { tx } from '@/shared/i18n';

/**
 * GET /api/go?p=partenaire&place=…&name=…&address=…&lat=…&lng=…
 * Compte le clic (journal serveur) puis redirige vers le partenaire.
 * L'URL de destination est toujours reconstruite à partir de affiliates.json :
 * impossible de s'en servir pour rediriger vers un site quelconque.
 */
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const partner = findPartner(q.get('p') ?? '', await activePartners());
  const placeId = q.get('place') ?? '';
  const name = (q.get('name') ?? '').slice(0, 200);
  const address = (q.get('address') ?? '').slice(0, 300);
  const location = parseLatLng(`${q.get('lat')},${q.get('lng')}`);

  if (!partner) return Response.json({ error: tx('Partenaire inconnu') }, { status: 404 });
  if (!PLACE_ID_PATTERN.test(placeId) || !name || !location) {
    return Response.json({ error: tx('Lien invalide') }, { status: 400 });
  }

  const url = partnerUrl(partner, { id: placeId, name, address, location });
  if (!url) return Response.json({ error: tx('Lien indisponible') }, { status: 404 });

  // Une ligne par clic, lisible dans les journaux d'EAS Hosting (sans donnée personnelle).
  console.info(
    '[affiliate-click]',
    JSON.stringify({ partner: partner.id, place: placeId, at: new Date().toISOString() }),
  );
  await recordClick({ partner: partner.id, placeId });
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
