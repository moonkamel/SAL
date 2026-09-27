// Liens d'affiliation : réservation de table, billetterie, VTC… Chaque clic passe par
// /api/go, qui le compte puis redirige vers le partenaire avec votre identifiant.
// Stockage : server/affiliates.json (versionné, vide par défaut ; modèle dans
// server/affiliates.example.json).

import { z } from 'zod';

import type { PartnerKind, PartnerLink, PlaceDetails } from '@/shared/types';

import rawPartners from './affiliates.json';

const PartnerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.enum(['booking', 'tickets', 'ride', 'delivery']),
  label: z.string().min(2).max(40),
  partner: z.string().min(2).max(40),
  /** Modèle d'URL : {name}, {address}, {lat}, {lng}, {placeId}, {city}. */
  urlTemplate: z.string().url().startsWith('https://').optional(),
  /** Types Google concernés (ex. « restaurant »). Absent = tous les lieux. */
  placeTypes: z.array(z.string()).optional(),
  /** Liens directs par place_id (prioritaires sur le modèle). */
  places: z.record(z.string(), z.string().url().startsWith('https://')).optional(),
  active: z.boolean().default(true),
});

export type Partner = z.infer<typeof PartnerSchema>;

export function loadPartners(raw: unknown): Partner[] {
  const parsed = z.array(PartnerSchema).safeParse(raw);
  if (!parsed.success) {
    console.error('[affiliates] affiliates.json invalide, aucun lien partenaire', parsed.error);
    return [];
  }
  return parsed.data.filter((p) => p.active && (p.urlTemplate || p.places));
}

const PARTNERS = loadPartners(rawPartners);

/** Ordre d'affichage : réserver, puis sortir, puis rentrer. */
const KIND_ORDER: PartnerKind[] = ['booking', 'tickets', 'delivery', 'ride'];

export type LinkTarget = Pick<PlaceDetails, 'id' | 'name' | 'address' | 'location'>;

/** Remplit le modèle d'URL (valeurs encodées : pas d'injection possible). */
export function fillTemplate(template: string, place: LinkTarget): string {
  const values: Record<string, string> = {
    name: place.name,
    address: place.address,
    lat: place.location.lat.toFixed(6),
    lng: place.location.lng.toFixed(6),
    placeId: place.id,
    city: 'Lille',
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? encodeURIComponent(values[key]!) : match,
  );
}

/** URL finale chez le partenaire, ou null si ce partenaire ne couvre pas ce lieu. */
export function partnerUrl(partner: Partner, place: LinkTarget): string | null {
  const direct = partner.places?.[place.id];
  if (direct) return direct;
  return partner.urlTemplate ? fillTemplate(partner.urlTemplate, place) : null;
}

function covers(partner: Partner, place: LinkTarget & { types?: string[] }): boolean {
  if (partner.places?.[place.id]) return true;
  if (!partner.urlTemplate) return false;
  if (!partner.placeTypes?.length) return true;
  return partner.placeTypes.some((t) => place.types?.includes(t));
}

/** Chemin /api/go : le serveur reconstruit l'URL, le client ne peut pas la choisir. */
export function goPath(partnerId: string, place: LinkTarget): string {
  const q = new URLSearchParams({
    p: partnerId,
    place: place.id,
    name: place.name,
    address: place.address,
    lat: place.location.lat.toFixed(6),
    lng: place.location.lng.toFixed(6),
  });
  return `/api/go?${q.toString()}`;
}

/** Au plus un lien par type (réservation, billetterie…), 3 au total. */
export function linksFor(
  place: LinkTarget & { types?: string[] },
  partners: Partner[] = PARTNERS,
): PartnerLink[] {
  const seen = new Set<PartnerKind>();
  return partners
    .filter((p) => covers(p, place))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .filter((p) => (seen.has(p.kind) ? false : (seen.add(p.kind), true)))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      label: p.label,
      partner: p.partner,
      path: goPath(p.id, place),
    }));
}

export function findPartner(id: string, partners: Partner[] = PARTNERS): Partner | undefined {
  return partners.find((p) => p.id === id);
}
