// Lieux sponsorisés : campagnes (place_id, dates, zone, mots-clés) qui remontent un
// lieu en tête des résultats, toujours avec le badge « Sponsorisé ».
// Stockage : server/sponsored.json (versionné). À remplacer par une base de données
// (ex. Supabase) quand il faudra gérer les campagnes sans redéployer.

import { z } from 'zod';

import { haversineMeters } from '@/shared/geo';
import type { LatLng } from '@/shared/types';

import rawCampaigns from './sponsored.json';

const CampaignSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(10),
  label: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  zone: z.object({
    lat: z.number(),
    lng: z.number(),
    radiusMeters: z.number().positive(),
  }),
  keywords: z.array(z.string().min(2)).min(1),
});

export type SponsoredCampaign = z.infer<typeof CampaignSchema>;

/** Au plus 2 lieux sponsorisés par recherche, pour garder des résultats utiles. */
export const MAX_SPONSORED = 2;

export function loadCampaigns(raw: unknown): SponsoredCampaign[] {
  const parsed = z.array(CampaignSchema).safeParse(raw);
  if (!parsed.success) {
    console.error('[sponsored] sponsored.json invalide, aucune campagne active', parsed.error);
    return [];
  }
  return parsed.data;
}

const CAMPAIGNS = loadCampaigns(rawCampaigns);

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

export function activeCampaigns(ctx: SponsoredContext): SponsoredCampaign[] {
  return matchingCampaigns(CAMPAIGNS, ctx);
}
