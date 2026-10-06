// Lieux sponsorisés : campagnes (place_id, dates, zone, mots-clés) qui remontent un
// lieu en tête des résultats, toujours avec le badge « Sponsorisé ».
// Stockage : espace partenaires (Supabase) ou, à défaut, server/sponsored.json.

import { haversineMeters } from '@/shared/geo';
import type { LatLng } from '@/shared/types';

import { getContent } from './content';
import { type SponsoredCampaign, validItems } from './schemas';

export type { SponsoredCampaign };

/** Au plus 2 lieux sponsorisés par recherche, pour garder des résultats utiles. */
export const MAX_SPONSORED = 2;

export function loadCampaigns(raw: unknown): SponsoredCampaign[] {
  return validItems('sponsored', raw);
}

/** Minuscules, sans accents ni ponctuation : « Boîte de nuit ! » → « boite de nuit ». */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const parisDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface SponsoredContext {
  /** Requête tapée et requête reformulée (si différente). */
  queries: string[];
  location: LatLng;
  now?: Date;
}

export function matchingCampaigns(
  campaigns: SponsoredCampaign[],
  ctx: SponsoredContext,
): SponsoredCampaign[] {
  const today = parisDate.format(ctx.now ?? new Date()); // AAAA-MM-JJ
  const texts = ctx.queries.map((q) => ` ${normalize(q)} `);
  const seen = new Set<string>();

  return campaigns
    .filter((c) => c.startDate <= today && today <= c.endDate)
    .filter(
      (c) =>
        haversineMeters(ctx.location, { lat: c.zone.lat, lng: c.zone.lng }) <= c.zone.radiusMeters,
    )
    .filter((c) =>
      c.keywords.some((k) => texts.some((t) => t.includes(` ${normalize(k)} `))),
    )
    .filter((c) => (seen.has(c.placeId) ? false : (seen.add(c.placeId), true)))
    .slice(0, MAX_SPONSORED);
}

export async function activeCampaigns(ctx: SponsoredContext): Promise<SponsoredCampaign[]> {
  return matchingCampaigns(await getContent('sponsored'), ctx);
}
