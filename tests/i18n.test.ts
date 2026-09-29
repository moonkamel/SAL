import { describe, expect, it } from 'vitest';

import { formatOpening, formatRatingCount, formatWalk } from '@/shared/format';
import { decimal, langFromHeader, LANGS, translate } from '@/shared/i18n';
import de from '@/shared/i18n/locales/de.json';
import en from '@/shared/i18n/locales/en.json';
import es from '@/shared/i18n/locales/es.json';
import nl from '@/shared/i18n/locales/nl.json';
import { weatherSuggestion } from '@/shared/suggest';
import { momentLabel } from '@/src/lib/moment';

import { collectKeys, placeholders } from '../scripts/i18n-keys.mjs';

const DICTS: Record<string, Record<string, string>> = { en, nl, de, es };

describe('traductions', () => {
  const keys: string[] = collectKeys();

  it('trouve les textes à traduire dans le code', () => {
    expect(keys.length).toBeGreaterThan(200);
    expect(keys).toContain('Surprends-moi');
    expect(keys).toContain('{n} adresses autour de vous');
  });

  it.each(Object.keys(DICTS))('%s : chaque texte est traduit, avec les mêmes {variables}', (lang) => {
    const dict = DICTS[lang]!;
    const missing = keys.filter((k) => !dict[k]);
    expect(missing, 'lancez « npm run translate »').toEqual([]);
    for (const k of keys) expect(placeholders(dict[k]!), k).toEqual(placeholders(k));
  });

  it('traduit, remplace les variables et retombe sur le français', () => {
    expect(translate('en', 'Favoris')).toBe('Favourites');
    expect(translate('de', '{n} Bewertungen')).toBe('{n} Bewertungen'); // inconnu : inchangé
    expect(translate('es', 'Partez dans {n} min', { n: 5 })).toBe('Sal en 5 min');
    expect(translate('fr', 'Partez dans {n} min', { n: 5 })).toBe('Partez dans 5 min');
  });

  it('lit la langue envoyée par l’app', () => {
    expect(langFromHeader('en')).toBe('en');
    expect(langFromHeader('nl-BE,nl;q=0.9')).toBe('nl');
    expect(langFromHeader('it-IT')).toBe('fr');
    expect(langFromHeader(null)).toBe('fr');
    expect(LANGS).toEqual(['fr', 'en', 'nl', 'de', 'es']);
  });

  it('formate distances, notes et horaires dans la langue', () => {
    expect(decimal('en', '4.5')).toBe('4.5');
    expect(decimal('de', '4.5')).toBe('4,5');
    expect(formatWalk(12, 'en')).toBe('~12 min walk');
    expect(formatRatingCount(1200, 'en')).toBe('1.2k reviews');
    expect(formatOpening({ openNow: true, closesAt: '23:00' }, 'de')).toBe('Geöffnet · schließt um 23:00');
    expect(momentLabel(new Date(2026, 8, 26, 21), 'en')).toBe('SATURDAY EVENING · LILLE');
    expect(momentLabel(new Date(2026, 8, 26, 21), 'nl')).toBe('ZATERDAGAVOND · LILLE');
  });

  it('traduit l’idée météo mais garde la recherche en français', () => {
    const s = weatherSuggestion({ temperature: 21, condition: 'clear', isDay: true }, 15, 'en');
    expect(s.title).toBe('21 °C and sunny');
    expect(s.query).toBe('bar');
    expect(s.ambiance).toEqual(['terrace']);
  });
});
