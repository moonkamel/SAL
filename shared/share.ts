// Texte partagé (WhatsApp, SMS…) pour recommander un lieu à un ami.

import { formatRating } from './format';
import { type Lang, translate } from './i18n';
import type { PlaceDetails } from './types';

export function shareMessage(
  place: Pick<PlaceDetails, 'name' | 'address' | 'rating' | 'googleMapsUri'>,
  appUrl?: string,
  lang: Lang = 'fr',
): string {
  const lines = [place.name, place.address];
  if (place.rating !== undefined) {
    lines.push(translate(lang, '{rating} ★ sur Google', { rating: formatRating(place.rating, lang) }));
  }
  const link = appUrl ?? place.googleMapsUri;
  if (link) lines.push('', link);
  lines.push('', translate(lang, 'Trouvé avec Sortir à Lille'));
  return lines.join('\n');
}
