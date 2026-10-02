// Schémas des contenus gérés depuis l'espace partenaires (ou les fichiers JSON) :
// lieux sponsorisés, liens partenaires, bons plans et événements de l'agenda.

import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue au format HH:MM');
const slug = z.string().regex(/^[a-z0-9-]{2,60}$/, 'Identifiant : minuscules, chiffres et tirets');
const httpsUrl = z.string().url().startsWith('https://', 'Lien https obligatoire');
const placeId = z.string().regex(/^[A-Za-z0-9_-]{10,300}$/, 'place_id Google invalide');
const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const CampaignSchema = z.object({
  id: slug,
  placeId,
  label: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  zone: latLng.extend({ radiusMeters: z.number().positive() }),
  keywords: z.array(z.string().min(2)).min(1),
});

export const PartnerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.enum(['booking', 'tickets', 'ride', 'delivery']),
  label: z.string().min(2).max(40),
  partner: z.string().min(2).max(40),
  /** Modèle d'URL : {name}, {address}, {lat}, {lng}, {placeId}, {city}. */
  urlTemplate: httpsUrl.optional(),
  /** Types Google concernés (ex. « restaurant »). Absent = tous les lieux. */
  placeTypes: z.array(z.string()).optional(),
  /** Liens directs par place_id (prioritaires sur le modèle). */
  places: z.record(z.string(), httpsUrl).optional(),
  active: z.boolean().default(true),
});

export const OfferSchema = z.object({
  id: slug,
  placeId,
  /** Nom et position saisis dans l'espace partenaires (pas de donnée Google stockée). */
  placeName: z.string().min(1).max(80),
  location: latLng,
  title: z.string().min(3).max(60),
  description: z.string().max(240).optional(),
  conditions: z.string().max(160).optional(),
  startDate: isoDate,
  endDate: isoDate,
  /** Jours concernés, 0 = dimanche … 6 = samedi. Absent = tous les jours. */
  days: z.array(z.number().int().min(0).max(6)).optional(),
  /** Créneau horaire (heure de Lille). Absent = toute la journée. */
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  active: z.boolean().default(true),
});

export const EventSchema = z.object({
  id: slug,
  title: z.string().min(3).max(100),
  description: z.string().max(400).optional(),
  category: z.enum(['concert', 'soiree', 'expo', 'spectacle', 'marche', 'sport', 'autre']),
  venueName: z.string().min(1).max(80),
  /** Lieu Google, pour ouvrir sa fiche depuis l'agenda (facultatif). */
  placeId: placeId.optional(),
  location: latLng,
  address: z.string().max(160).optional(),
  /** Début et fin, en ISO 8601 avec fuseau (ex. 2026-10-03T21:00:00+02:00). */
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }).optional(),
  price: z.string().max(40).optional(),
  url: httpsUrl.optional(),
  imageUrl: httpsUrl.optional(),
  /** « À la une » : événement sponsorisé, affiché en premier avec un badge. */
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const CONTENT_SCHEMAS = {
  sponsored: CampaignSchema,
  affiliates: PartnerSchema,
  offers: OfferSchema,
  events: EventSchema,
} as const;

export type ContentKind = keyof typeof CONTENT_SCHEMAS;
export const CONTENT_KINDS = Object.keys(CONTENT_SCHEMAS) as ContentKind[];

export type SponsoredCampaign = z.infer<typeof CampaignSchema>;
export type Partner = z.infer<typeof PartnerSchema>;
export type OfferItem = z.infer<typeof OfferSchema>;
export type EventItem = z.infer<typeof EventSchema>;

export interface ContentTypes {
  sponsored: SponsoredCampaign;
  affiliates: Partner;
  offers: OfferItem;
  events: EventItem;
}

/** Garde les éléments valides ; un élément mal saisi n'empêche pas les autres de s'afficher. */
export function validItems<K extends ContentKind>(kind: K, raw: unknown): ContentTypes[K][] {
  if (!Array.isArray(raw)) return [];
  const out: ContentTypes[K][] = [];
  for (const item of raw) {
    const parsed = CONTENT_SCHEMAS[kind].safeParse(item);
    if (parsed.success) out.push(parsed.data as ContentTypes[K]);
    else console.error(`[content] ${kind} ignoré (invalide)`, (item as { id?: string })?.id);
  }
  return out;
}

/** Message d'erreur lisible pour l'espace partenaires. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join('.') || 'élément'} : ${i.message}`)
    .slice(0, 5)
    .join(' ; ');
}
