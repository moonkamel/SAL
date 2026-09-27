// Reformulation optionnelle d'une requête libre (« un bar calme pour discuter »)
// en requête Google Places + filtres, via l'API Claude.
// Sans ANTHROPIC_API_KEY (ou avec ENABLE_LLM_REWRITE=false), la requête brute est utilisée.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import type { Ambiance, PriceLevel } from '@/shared/types';

// Types Google Places (Table A) utiles pour les sorties à Lille.
export const INCLUDED_TYPES = [
  'restaurant',
  'japanese_restaurant',
  'sushi_restaurant',
  'ramen_restaurant',
  'chinese_restaurant',
  'thai_restaurant',
  'vietnamese_restaurant',
  'korean_restaurant',
  'indian_restaurant',
  'italian_restaurant',
  'pizza_restaurant',
  'french_restaurant',
  'mexican_restaurant',
  'lebanese_restaurant',
  'hamburger_restaurant',
  'vegan_restaurant',
  'vegetarian_restaurant',
  'seafood_restaurant',
  'steak_house',
  'brunch_restaurant',
  'breakfast_restaurant',
  'fast_food_restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'ice_cream_shop',
  'bar',
  'wine_bar',
  'pub',
  'night_club',
  'karaoke',
  'movie_theater',
  'bowling_alley',
  'museum',
  'art_gallery',
  'performing_arts_theater',
  'concert_hall',
  'park',
] as const;

const RewriteSchema = z.object({
  textQuery: z.string(),
  includedType: z.enum(INCLUDED_TYPES).nullable(),
  openNow: z.boolean().nullable(),
  priceLevels: z.array(z.number().int()).nullable(),
  minRating: z.number().nullable(),
  ambiance: z
    .array(z.enum(['terrace', 'liveMusic', 'groups', 'kids', 'cocktails', 'vegetarian', 'accessible']))
    .nullable(),
});

export interface RewriteResult {
  textQuery: string;
  includedType?: string;
  openNow?: boolean;
  priceLevels?: PriceLevel[];
  minRating?: number;
  ambiance?: Ambiance[];
}

const SYSTEM_PROMPT = `Tu transformes une recherche libre d'un utilisateur de l'application « Sortir à Lille » en paramètres pour Google Places Text Search.
L'utilisateur est dans la métropole lilloise et cherche un lieu où sortir (manger, boire un verre, danser, se divertir).

Règles :
- textQuery : une requête courte en français, efficace pour Google Places (ex. « restaurant japonais », « boîte de nuit », « bar à cocktails calme »). Ne mets pas « Lille » : la position est déjà fournie. Garde les nuances utiles (calme, terrasse, pas cher…).
- includedType : seulement si un type de la liste correspond clairement à la demande, sinon null. Pour « aller danser », utilise night_club.
- openNow : true uniquement si l'utilisateur précise « maintenant », « ce soir », « encore ouvert »… sinon null.
- priceLevels : niveaux acceptés (1 = bon marché, 2 = modéré, 3 = cher, 4 = très cher) seulement si l'utilisateur parle de budget, sinon null.
- minRating : note minimale (ex. 4) seulement si l'utilisateur demande explicitement un lieu « bien noté », sinon null.
- ambiance : seulement les critères explicitement demandés, sinon null. terrace = terrasse / dehors ; liveMusic = musique live / concert ; groups = en groupe / entre potes / « pour 8 » ; kids = avec enfants / en famille ; cocktails = cocktails ; vegetarian = végétarien / vegan ; accessible = accessible en fauteuil roulant / PMR / handicap.`;

let client: Anthropic | null = null;

export function isRewriteEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ENABLE_LLM_REWRITE !== 'false';
}

function getClient(): Anthropic {
  // Reformulation = confort : on préfère renvoyer la requête brute plutôt que faire attendre.
  client ??= new Anthropic({ timeout: 6_000, maxRetries: 0 });
  return client;
}

/** Renvoie null si la reformulation est désactivée ou échoue : l'appelant utilise alors la requête brute. */
export async function rewriteQuery(query: string): Promise<RewriteResult | null> {
  if (!isRewriteEnabled()) return null;

  try {
    const response = await getClient().messages.parse({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
      output_config: {
        effort: 'low',
        format: zodOutputFormat(RewriteSchema),
      },
    });

    if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
    const out = response.parsed_output;
    const textQuery = out.textQuery.trim();
    if (!textQuery) return null;

    const priceLevels = out.priceLevels?.filter((p): p is PriceLevel => p >= 1 && p <= 4);
    const minRating =
      out.minRating !== null && out.minRating >= 1 && out.minRating <= 5
        ? Math.round(out.minRating * 2) / 2 // Google accepte des pas de 0,5
        : undefined;

    return {
      textQuery,
      includedType: out.includedType ?? undefined,
      openNow: out.openNow ?? undefined,
      priceLevels: priceLevels?.length ? priceLevels : undefined,
      minRating,
      ambiance: out.ambiance?.length ? out.ambiance : undefined,
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn('[rewrite] limite de débit atteinte, requête brute utilisée');
    } else if (error instanceof Anthropic.APIError) {
      console.warn(`[rewrite] erreur API ${error.status}, requête brute utilisée`);
    } else {
      console.warn('[rewrite] échec, requête brute utilisée', error);
    }
    return null;
  }
}
