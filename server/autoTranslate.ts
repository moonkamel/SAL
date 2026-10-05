// Traduction automatique des textes saisis en français qui ne sont pas dans les
// dictionnaires de l'app : événements de l'agenda, bons plans des partenaires.
// Via l'API Claude, avec un cache mémoire. Sans ANTHROPIC_API_KEY (ou avec
// ENABLE_AUTO_TRANSLATE=false), les textes restent en français.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { type Lang, LANG_INFO } from '@/shared/i18n';

import { TtlCache } from './cache';

// Un texte traduit ne change pas : on le garde une journée (en mémoire uniquement).
const cache = new TtlCache<string>(24 * 60 * 60 * 1000, 5000);
// Petits lots, nombreux en parallèle : chaque appel reste court (une semaine
// d'agenda, c'est plusieurs centaines de titres et descriptions).
const BATCH = 25;
const PARALLEL = 8;
const MAX_CHARS = 1500;
// Au-delà, on répond avec ce qui est traduit ; le reste le sera à la prochaine ouverture.
const BUDGET_MS = 20_000;

/** Dernière erreur de traduction (diagnostic ?debug=1, sans la clé). */
export let lastTranslateError: string | undefined;

let client: Anthropic | null = null;

export function isAutoTranslateEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ENABLE_AUTO_TRANSLATE !== 'false';
}

function getClient(): Anthropic {
  // Confort : mieux vaut le français tout de suite qu'une longue attente.
  client ??= new Anthropic({ timeout: 18_000, maxRetries: 1 });
  return client;
}

const OutputSchema = z.object({ translations: z.array(z.string()) });

async function translateBatch(texts: string[], lang: Lang): Promise<string[] | null> {
  const language = LANG_INFO[lang].name;
  try {
    const response = await getClient().messages.parse({
      model: process.env.ANTHROPIC_TRANSLATE_MODEL || 'claude-haiku-4-5',
      max_tokens: 8000,
      system:
        `Tu traduis du français vers la langue « ${language} » les textes d'une application de sorties à Lille ` +
        '(titres et descriptions d’événements, offres de bars et restaurants). Style naturel et court, ' +
        'comme une app locale. Ne traduis pas les noms propres (lieux, artistes, rues, « Vieux-Lille », « estaminet »). ' +
        'Garde les emojis, chiffres, prix et horaires. Réponds avec exactement autant de traductions que de textes, dans le même ordre.',
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
      output_config: { format: zodOutputFormat(OutputSchema) },
    });
    const out = response.parsed_output?.translations;
    if (response.stop_reason === 'refusal' || !out || out.length !== texts.length) {
      lastTranslateError = `réponse inattendue (${response.stop_reason}, ${out?.length ?? 0}/${texts.length})`;
      return null;
    }
    return out.map((t, i) => t.trim() || texts[i]!);
  } catch (error) {
    lastTranslateError = error instanceof Error ? error.message : String(error);
    console.warn(`[translate] échec (${lang}), textes laissés en français`, lastTranslateError);
    return null;
  }
}

/** Traduit des textes français dans `lang` ; en cas d'échec, renvoie les originaux. */
export async function autoTranslate(texts: string[], lang: Lang): Promise<string[]> {
  if (lang === 'fr' || texts.length === 0 || !isAutoTranslateEnabled()) return texts;

  const missing = [
    ...new Set(texts.filter((t) => t.trim() && t.length <= MAX_CHARS && cache.get(`${lang}|${t}`) === undefined)),
  ];
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));
  // Plusieurs lots en parallèle ; un lot en échec n'empêche pas les autres.
  const started = Date.now();
  for (let i = 0; i < batches.length && Date.now() - started < BUDGET_MS; i += PARALLEL) {
    const group = batches.slice(i, i + PARALLEL);
    const results = await Promise.all(group.map((batch) => translateBatch(batch, lang)));
    group.forEach((batch, g) => {
      const done = results[g];
      if (done) batch.forEach((t, j) => cache.set(`${lang}|${t}`, done[j]!));
    });
    // Tout un groupe en échec (clé refusée, service indisponible) : inutile d'insister.
    if (results.every((r) => r === null)) break;
  }
  return texts.map((t) => cache.get(`${lang}|${t}`) ?? t);
}

/** Traduit certains champs texte d'une liste d'objets (en un seul lot). */
export async function translateFields<T extends object, K extends keyof T>(
  items: T[],
  fields: K[],
  lang: Lang,
): Promise<T[]> {
  if (lang === 'fr' || items.length === 0 || !isAutoTranslateEnabled()) return items;
  const texts: string[] = [];
  for (const item of items) {
    for (const f of fields) {
      const v = item[f];
      if (typeof v === 'string') texts.push(v);
    }
  }
  const translated = await autoTranslate(texts, lang);
  let k = 0;
  return items.map((item) => {
    const copy = { ...item };
    for (const f of fields) {
      if (typeof item[f] === 'string') copy[f] = translated[k++] as T[K];
    }
    return copy;
  });
}
