// Lecture du texte des événements : catégorie, styles de musique, gratuité, texte simple.

import type { EventCategory, MusicGenre } from '@/shared/types';

/** Mot entier (les accents comptent comme des lettres) : « rap » ne matche pas « photographique ». */
const word = (pattern: string) => new RegExp(`(?<![\\p{L}\\d])(?:${pattern})(?![\\p{L}\\d])`, 'iu');

// Ordre = priorité : une « exposition photo lors d'un festival » reste une expo.
const CATEGORIES: [EventCategory, RegExp][] = [
  ['expo', word('expos?|expositions?|galerie|vernissage|collections?|mus[ée]es?|photographies?|installations?|biennale')],
  ['marche', word('march[ée]s?|brocante|braderie|vide[- ]greniers?|foire|salon')],
  ['spectacle', word('spectacles?|th[ée][âa]tre|danse|cirque|humour|stand[- ]up|cin[ée]ma|projection|film|op[ée]ra|com[ée]die|lecture|conte|marionnettes?|performance')],
  ['concert', word('concerts?|live|r[ée]cital|orchestre|dj|dj set|chorale|quatuor|fanfare|festival de musique|jam')],
  ['soiree', word('soir[ée]es?|clubbing|f[êe]te|bal|guinguette|nuit|afterwork|blind test|karaok[ée]')],
  ['sport', word('sport|match|course|foot(ball)?|basket|tournoi|marathon|yoga|randonn[ée]e')],
];

/** Catégorie d'après le titre d'abord (plus fiable), puis la description et les mots-clés. */
export function categorize(title: string, ...rest: (string | undefined)[]): EventCategory {
  for (const text of [title, rest.filter(Boolean).join(' ')]) {
    const hit = CATEGORIES.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return 'autre';
}

const GENRES: [MusicGenre, RegExp][] = [
  ['jazz', word('jazz|swing|blues|manouche|bebop|big band')],
  ['rock', word('rock|punk|m[ée]tal|metal|garage|grunge|hard rock|indie')],
  ['electro', word('[ée]lectro|techno|house|dj|dj set|drum and bass|ambient|trance|disco')],
  ['rap', word('rap|hip[- ]?hop|r&b|rnb|slam|trap|soul|funk')],
  ['classique', word('classique|orchestre|symphoni(e|que)|baroque|op[ée]ra|piano|quatuor|r[ée]cital|musique de chambre|chorale|lyrique')],
  ['chanson', word('chanson|vari[ée]t[ée]s?|pop|cabaret')],
  ['monde', word('musiques? du monde|world|afro|latino|salsa|reggae|flamenco|fado|cumbia|klezmer|orientale?|brésilienne|bossa')],
  ['folk', word('folk|acoustique|country|bluegrass|celtique|irlandaise')],
];

export function detectGenres(...texts: (string | undefined)[]): MusicGenre[] {
  const all = texts.filter(Boolean).join(' ');
  return GENRES.filter(([, re]) => re.test(all)).map(([g]) => g);
}

export function isFree(...texts: (string | undefined)[]): boolean {
  return /gratuit|entr[ée]e libre|libre participation|acc[èe]s libre|free/i.test(texts.filter(Boolean).join(' '));
}

/** Markdown ou HTML → texte simple lisible. */
export function plainText(value: string | undefined, max = 1500): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
