// Orchestration d'une recherche : reformulation → Places Text Search → classement.

import { z } from 'zod';

import { estimateWalkMinutes, haversineMeters, SEARCH_RADIUS_METERS } from '@/shared/geo';
import { detailsToSummary } from '@/shared/summary';
import type {
  Ambiance,
  PlaceDetails,
  PlaceSummary,
  PriceLevel,
  SearchFilters,
  SearchRequest,
  SearchResponse,
} from '@/shared/types';

import { TtlCache } from './cache';
import { placeDetails, type RawPlace, textSearch } from './places';
import { scorePlace } from './ranking';
import { rewriteQuery } from './rewrite';
import { activeCampaigns, type SponsoredCampaign } from './sponsored';

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(120),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  filters: z
    .object({
      openNow: z.boolean().optional(),
      maxDistanceMeters: z.number().positive().max(50_000).optional(),
      priceLevels: z
        .array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]))
        .optional(),
      minRating: z.number().min(0).max(5).optional(),
      ambiance: z
        .array(z.enum(['terrace', 'liveMusic', 'groups', 'kids', 'cocktails', 'vegetarian', 'accessible']))
        .max(7)
        .optional(),
    })
    .optional(),
});

interface CachedSearch {
  places: RawPlace[];
  effectiveQuery: string;
  rewritten: boolean;
  /** Ambiances appliquées (choisies par l'utilisateur ou déduites par Claude). */
  ambiance: Ambiance[];
}

// Mots ajoutés à la requête Google pour orienter la pertinence vers l'ambiance voulue.
const AMBIANCE_HINTS: Partial<Record<Ambiance, string>> = {
  terrace: 'terrasse',
  liveMusic: 'concert',
  cocktails: 'cocktails',
  vegetarian: 'végétarien',
};

export function withAmbianceHints(query: string, ambiance: Ambiance[]): string {
  const lower = query.toLowerCase();
  const hints = ambiance
    .map((a) => AMBIANCE_HINTS[a])
    .filter((h): h is string => !!h && !lower.includes(h));
  return [query, ...hints].join(' ');
}

const ttlSeconds = Number(process.env.SEARCH_CACHE_TTL_SECONDS ?? 300);
const cache = new TtlCache<CachedSearch>(ttlSeconds * 1000);

/** ~110 m de précision : deux utilisateurs voisins partagent le même cache. */
function roundCoord(value: number): string {
  return value.toFixed(3);
}

export function cacheKey(req: SearchRequest): string {
  const f = req.filters ?? {};
  return JSON.stringify([
    req.query.trim().toLowerCase().replace(/\s+/g, ' '),
    roundCoord(req.location.lat),
    roundCoord(req.location.lng),
    f.openNow ?? false,
    [...(f.priceLevels ?? [])].sort(),
    f.minRating ?? 0,
    [...(f.ambiance ?? [])].sort(),
  ]);
}

async function fetchPlaces(req: SearchRequest): Promise<CachedSearch> {
  const key = cacheKey(req);
  const hit = cache.get(key);
  if (hit) return hit;

  const rewrite = await rewriteQuery(req.query);
  const f = req.filters ?? {};
  // Les filtres choisis par l'utilisateur priment sur ceux déduits par Claude.
  const priceLevels: PriceLevel[] | undefined = f.priceLevels?.length
    ? f.priceLevels
    : rewrite?.priceLevels;

  const ambiance: Ambiance[] = f.ambiance?.length ? f.ambiance : (rewrite?.ambiance ?? []);
  const effectiveQuery = withAmbianceHints(rewrite?.textQuery ?? req.query.trim(), ambiance);
  const places = await textSearch({
    textQuery: effectiveQuery,
    ambiance,
    center: req.location,
    radiusMeters: SEARCH_RADIUS_METERS,
    includedType: rewrite?.includedType,
    openNow: f.openNow ?? rewrite?.openNow,
    minRating: f.minRating ?? rewrite?.minRating,
    priceLevels,
  });

  const result: CachedSearch = { places, effectiveQuery, rewritten: rewrite !== null, ambiance };
  cache.set(key, result);
  return result;
}

/** Vrai si Google confirme toutes les ambiances demandées pour ce lieu. */
export function hasAmbiance(place: { ambiance?: Ambiance[] }, wanted: Ambiance[]): boolean {
  return wanted.every((a) => place.ambiance?.includes(a));
}

export function rankPlaces(
  places: RawPlace[],
  req: SearchRequest,
  ambiance: Ambiance[] = [],
): PlaceSummary[] {
  const maxDistance = req.filters?.maxDistanceMeters;
  return places
    .filter((place) => hasAmbiance(place, ambiance))
    .map((place, index) => {
      const distanceMeters = Math.round(haversineMeters(req.location, place.location));
      const score = scorePlace({
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        distanceMeters,
        relevanceIndex: index,
        resultCount: places.length,
      });
      return {
        ...place,
        distanceMeters,
        walkMinutes: estimateWalkMinutes(distanceMeters),
        sponsored: false,
        score,
        ambiance: ambiance.length ? place.ambiance : undefined,
      };
    })
    .filter((p) => maxDistance === undefined || p.distanceMeters <= maxDistance)
    .sort((a, b) => b.score - a.score);
}

/** Un lieu sponsorisé doit respecter les filtres choisis par l'utilisateur. */
export function passesFilters(p: PlaceSummary, f: SearchFilters = {}): boolean {
  if (f.openNow && !p.opening?.openNow) return false;
  if (f.maxDistanceMeters !== undefined && p.distanceMeters > f.maxDistanceMeters) return false;
  if (f.priceLevels?.length && (p.priceLevel === undefined || !f.priceLevels.includes(p.priceLevel)))
    return false;
  if (f.minRating && (p.rating ?? 0) < f.minRating) return false;
  if (f.ambiance?.length && !hasAmbiance(p, f.ambiance)) return false;
  return true;
}

/** Lieux sponsorisés en tête (badge visible), puis les résultats sans doublon. */
export function mergeSponsored(sponsored: PlaceSummary[], organic: PlaceSummary[]): PlaceSummary[] {
  const ids = new Set(sponsored.map((p) => p.id));
  return [...sponsored, ...organic.filter((p) => !ids.has(p.id))];
}

const sponsoredDetailsCache = new TtlCache<PlaceDetails>(ttlSeconds * 1000, 200);

async function resolveSponsored(
  campaigns: SponsoredCampaign[],
  organic: PlaceSummary[],
  req: SearchRequest,
): Promise<PlaceSummary[]> {
  const resolved = await Promise.all(
    campaigns.map(async (c): Promise<PlaceSummary | null> => {
      const inResults = organic.find((p) => p.id === c.placeId);
      if (inResults) return { ...inResults, sponsored: true };
      try {
        // Absent des résultats Google : on charge sa fiche (sans avis, donc moins cher).
        // Avec un filtre d'ambiance, il faut la fiche complète pour le vérifier.
        const mode = req.filters?.ambiance?.length ? 'full' : 'summary';
        let details = sponsoredDetailsCache.get(`${mode}|${c.placeId}`);
        if (!details) {
          details = await placeDetails(c.placeId, mode);
          sponsoredDetailsCache.set(`${mode}|${c.placeId}`, details);
        }
        return { ...detailsToSummary(details, req.location, true), ambiance: details.ambiance };
      } catch (error) {
        console.warn(`[sponsored] campagne ${c.id} ignorée`, error);
        return null;
      }
    }),
  );
  return resolved.filter((p): p is PlaceSummary => p !== null && passesFilters(p, req.filters));
}

export async function search(req: SearchRequest): Promise<SearchResponse> {
  const { places, effectiveQuery, rewritten, ambiance } = await fetchPlaces(req);
  const organic = rankPlaces(places, req, ambiance);
  const campaigns = activeCampaigns({
    queries: [req.query, effectiveQuery],
    location: req.location,
  });
  const sponsored = campaigns.length ? await resolveSponsored(campaigns, organic, req) : [];
  return { places: mergeSponsored(sponsored, organic), effectiveQuery, rewritten };
}
