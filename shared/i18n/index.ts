// Traductions de l'app. Le français est la langue source : chaque texte sert lui-même
// de clé (« Favoris » → « Favourites »). Les fichiers locales/*.json sont générés par
// `npm run translate` (voir scripts/translate.mjs) ; un texte absent reste en français.

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import nl from './locales/nl.json';

/** Français + les langues des 5 nationalités qui visitent le plus Lille. */
export const LANGS = ['fr', 'en', 'nl', 'de', 'es'] as const;
export type Lang = (typeof LANGS)[number];

export interface LangInfo {
  /** Nom de la langue dans cette langue. */
  name: string;
  /** Drapeaux des pays concernés (emoji). */
  flags: string[];
  /** Pays, pour l'accessibilité et l'écran de choix. */
  countries: string;
  /** Locale pour les dates et heures (Intl). */
  locale: string;
}

export const LANG_INFO: Record<Lang, LangInfo> = {
  fr: { name: 'Français', flags: ['🇫🇷', '🇧🇪'], countries: 'France · Belgique', locale: 'fr-FR' },
  en: { name: 'English', flags: ['🇬🇧'], countries: 'United Kingdom', locale: 'en-GB' },
  nl: { name: 'Nederlands', flags: ['🇧🇪', '🇳🇱'], countries: 'België · Nederland', locale: 'nl-BE' },
  de: { name: 'Deutsch', flags: ['🇩🇪'], countries: 'Deutschland', locale: 'de-DE' },
  es: { name: 'Español', flags: ['🇪🇸'], countries: 'España', locale: 'es-ES' },
};

const DICTS: Record<Exclude<Lang, 'fr'>, Record<string, string>> = { en, nl, de, es };

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/**
 * Marque un texte à traduire sans le traduire tout de suite (constantes de module) :
 * le script de traduction le repère, et l'écran l'affiche avec t(texte).
 */
export function tx<T extends string>(text: T): T {
  return text;
}

export type Vars = Record<string, string | number>;

/** Traduit un texte français ; {nom} est remplacé par vars.nom. */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  const out = lang === 'fr' ? text : (DICTS[lang][text] || text);
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Langue demandée par l'app (en-tête Accept-Language, ex. « en » ou « nl-BE,nl;q=0.9 »). */
export function langFromHeader(header: string | null | undefined): Lang {
  for (const part of (header ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'fr';
}

/** Virgule décimale partout sauf en anglais. */
export function decimal(lang: Lang, value: string): string {
  return lang === 'en' ? value : value.replace('.', ',');
}
