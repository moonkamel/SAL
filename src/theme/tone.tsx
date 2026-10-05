// Tonalité de l'app : « nuit » (la direction artistique d'origine) ou « jour »
// (6 h – 19 h) : ciel bleu, façades de brique, pierre claire. Choisie à la racine
// (app/_layout.tsx) et appliquée à tous les écrans.
//
// Dans un composant :
//   const colors = useColors();             // couleurs de la tonalité en cours
//   const styles = useStyles();             // avec, au niveau du module :
//   const useStyles = themedStyles((colors) => ({ … }));

import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { colors as nightColors, gradients, palette, shadows } from './index';

export type Tone = 'night' | 'day';

export type ToneColors = { [K in keyof typeof nightColors]: string } & {
  /** Or très transparent (fonds d'étiquettes). */
  goldTint: string;
  /** Mot mis en valeur dans le titre (« à Lille »). */
  highlight: string;
  glassBorder: string;
  cardShadow: string;
  raisedShadow: string;
  /** Texte posé sur une photo assombrie : toujours clair. */
  onPhoto: string;
  onPhotoMuted: string;
  sky: readonly [string, string, ...string[]];
  /** Bas des photos assombri (texte clair posé dessus). */
  photoFade: readonly [string, string, ...string[]];
  /** Grande photo d'en-tête qui se fond dans le fond de l'écran. */
  heroFade: readonly [string, string, ...string[]];
};

export const TONES: Record<Tone, ToneColors> = {
  night: {
    ...nightColors,
    goldTint: 'rgba(230, 180, 90, 0.12)',
    highlight: nightColors.gold,
    glassBorder: 'rgba(245, 238, 226, 0.18)',
    cardShadow: shadows.card,
    raisedShadow: shadows.raised,
    onPhoto: palette.stone,
    onPhotoMuted: palette.stoneMuted,
    sky: gradients.sky,
    photoFade: gradients.photo,
    heroFade: gradients.photo,
  },
  day: {
    background: '#F6F0E6', // pierre de Lezennes
    surface: '#FFFFFF',
    surfaceRaised: '#FBF6EE',
    border: '#E6DCCB',
    text: '#1B2040',
    textMuted: '#5C6180',
    textFaint: '#8A8EA6',
    accent: palette.brick,
    accentText: '#FFFFFF',
    // Or assombri pour rester lisible sur la pierre claire.
    gold: '#A5701B',
    open: '#1E8F5C',
    closed: '#C93A2B',
    star: '#D39417',
    sponsored: '#A5701B',
    scrim: nightColors.scrim,
    glass: 'rgba(255, 255, 255, 0.78)',
    goldTint: 'rgba(165, 112, 27, 0.12)',
    highlight: palette.brickDeep,
    glassBorder: 'rgba(27, 32, 64, 0.12)',
    cardShadow: '0 6px 18px rgba(27, 32, 64, 0.10)',
    raisedShadow: '0 10px 28px rgba(27, 32, 64, 0.16)',
    onPhoto: palette.stone,
    onPhotoMuted: '#E2DCEA',
    // Bleu de midi vers un horizon doré, qui se fond dans la pierre du fond.
    sky: ['#5FA3D8', '#9CCBEE', '#F3DDBB'] as const,
    photoFade: ['rgba(10,13,28,0)', 'rgba(10,13,28,0.25)', 'rgba(10,13,28,0.80)'] as const,
    heroFade: ['rgba(246,240,230,0)', 'rgba(246,240,230,0.30)', 'rgba(246,240,230,0.97)'] as const,
  },
};

const ToneContext = createContext<Tone>('night');

export const ToneProvider = ToneContext.Provider;

export function useTone(): { tone: Tone; c: ToneColors } {
  const tone = useContext(ToneContext);
  return { tone, c: TONES[tone] };
}

/** Couleurs de la tonalité en cours (jour ou nuit). */
export function useColors(): ToneColors {
  return TONES[useContext(ToneContext)];
}

/**
 * Feuille de styles déclinée par tonalité : renvoie un hook qui donne les styles
 * du jour ou de la nuit (créés une seule fois chacun).
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ToneColors) => T & StyleSheet.NamedStyles<T>,
): () => T {
  const cache: Partial<Record<Tone, T>> = {};
  return function useStyles() {
    const tone = useContext(ToneContext);
    return (cache[tone] ??= StyleSheet.create(factory(TONES[tone])));
  };
}
