// Traduction automatique de l'app : `npm run translate`.
//
// 1. Repère tous les textes français du code (t('…'), tx('…'), translate(lang, '…')).
// 2. Pour chaque langue, demande à Claude de traduire ceux qui manquent dans
//    shared/i18n/locales/<langue>.json (les traductions existantes sont gardées :
//    vous pouvez les corriger à la main, elles ne seront pas écrasées).
// 3. Retire les textes qui ne sont plus utilisés.
//
// Options : --check (vérifie seulement, erreur s'il manque des traductions),
//           --force (retraduit tout).
// Nécessite ANTHROPIC_API_KEY (lue dans .env.local si présente).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectKeys, placeholders } from './i18n-keys.mjs';

const ROOT = process.cwd();
const LOCALES = join(ROOT, 'shared/i18n/locales');
const LANGS = { en: 'English (British)', nl: 'Nederlands (Belgian-friendly Dutch)', de: 'Deutsch', es: 'Español (Spain)' };
const BATCH = 60;

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const force = args.has('--force');

function loadEnvLocal() {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const SYSTEM = (language) => `You translate the user interface of "Sortir à Lille", a French mobile app for going out in Lille (bars, restaurants, events, public transport), into ${language}.
Rules:
- Short, natural, friendly UI wording, like a well-localised city app. Match the tone of the French (informal "vous" becomes the natural register of the target language; in German use "du"; in Dutch use "je"; in Spanish use "tú").
- Keep every {placeholder} exactly as is (same names, same braces); you may move it within the sentence.
- Keep proper nouns: Lille, Vieux-Lille, Grand-Place, V’Lille, Ilévia, OpenAgenda, Google Maps, estaminet (explain nothing), welsh, potjevleesch, carbonade.
- Words in UPPERCASE stay in uppercase. Keep emojis, ★, €, ·, →, …, °C.
- Search terms such as "bar à bières" or "salon de thé" must become the natural search phrase in the target language (e.g. "beer bar", "tea room").
- Reply with a JSON object mapping each French input string to its translation, nothing else.`;

async function translateBatch(client, texts, lang) {
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_TRANSLATE_MODEL || 'claude-sonnet-5',
    max_tokens: 16000,
    system: SYSTEM(LANGS[lang]),
    messages: [{ role: 'user', content: JSON.stringify(texts, null, 1) }],
  });
  const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  const out = {};
  for (const fr of texts) {
    const tr = json[fr];
    // Une traduction qui perd une {variable} est refusée : le texte restera en français.
    if (typeof tr === 'string' && tr.trim() && placeholders(tr).join() === placeholders(fr).join()) out[fr] = tr.trim();
    else console.warn(`  ! ${lang} : traduction rejetée pour « ${fr} »`);
  }
  return out;
}

async function main() {
  const keys = collectKeys(ROOT);
  let missingTotal = 0;
  let client = null;

  for (const lang of Object.keys(LANGS)) {
    const file = join(LOCALES, `${lang}.json`);
    const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const missing = keys.filter((k) => force || !existing[k]);
    missingTotal += missing.length;
    console.log(`${lang} : ${keys.length - missing.length}/${keys.length} textes traduits`);
    if (check || missing.length === 0) continue;

    if (!client) {
      loadEnvLocal();
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY manquante (ajoutez-la dans .env.local).');
        process.exit(1);
      }
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      client = new Anthropic();
    }

    const next = { ...existing };
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      process.stdout.write(`  traduction de ${batch.length} textes…`);
      Object.assign(next, await translateBatch(client, batch, lang));
      console.log(' ok');
    }
    // Seuls les textes encore utilisés sont gardés, triés pour des diffs lisibles.
    const sorted = Object.fromEntries(keys.filter((k) => next[k]).map((k) => [k, next[k]]));
    writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  if (check && missingTotal > 0) {
    console.error(`${missingTotal} traductions manquantes : lancez « npm run translate ».`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
