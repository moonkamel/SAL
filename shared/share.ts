// Texte partagé (WhatsApp, SMS…) pour recommander un lieu à un ami.

import { formatRating } from './format';
import type { PlaceDetails } from './types';

export function shareMessage(
  place: Pick<PlaceDetails, 'name' | 'address' | 'rating' | 'googleMapsUri'>,
  appUrl?: string,
): string {
  const lines = [place.name, place.address];
  if (place.rating !== undefined) lines.push(`${formatRating(place.rating)} ★ sur Google`);
  const link = appUrl ?? place.googleMapsUri;
  if (link) lines.push('', link);
  lines.push('', 'Trouvé avec Sortir à Lille');
  return lines.join('\n');
}
