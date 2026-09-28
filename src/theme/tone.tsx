// Tonalité de l'accueil : « nuit » (la direction artistique de l'app) ou « jour »
// (6 h – 19 h) : ciel bleu, façades de brique, pierre claire. Les autres écrans
// restent en tonalité nuit (valeur par défaut du contexte).

import { createContext, useContext } from 'react';

import { colors, gradients, palette, shadows } from './index';

export type Tone = 'night' | 'day';

export interface ToneColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Or (accents), assombri le jour pour rester lisible sur la pierre claire. */
  gold: string;
  goldTint: string;
  /** Mot mis en valeur dans le titre (« à Lille »). */
  highlight: string;
  glass: string;
  glassBorder: string;
  cardShadow: string;
  sky: readonly [string, string, ...string[]];
}

export const TONES: Record<Tone, ToneColors> = {
  night: {
    background: colors.background,
    surface: colors.surface,
    surfaceRaised: colors.surfaceRaised,
    border: colors.border,
    text: colors.text,
    textMuted: colors.textMuted,
    textFaint: colors.textFaint,
    gold: colors.gold,
    goldTint: 'rgba(230, 180, 90, 0.12)',
    highlight: colors.gold,
    glass: colors.glass,
    glassBorder: 'rgba(245, 238, 226, 0.18)',
    cardShadow: shadows.card,
    sky: gradients.sky,
  },
  day: {
    background: '#F6F0E6', // pierre de Lezennes
    surface: '#FFFFFF',
    surfaceRaised: '#FFFDF8',
    border: '#E6DCCB',
    text: '#1B2040',
    textMuted: '#5C6180',
    textFaint: '#9296AC',
    gold: '#A5701B',
    goldTint: 'rgba(165, 112, 27, 0.12)',
    highlight: palette.brickDeep,
    glass: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(27, 32, 64, 0.12)',
    cardShadow: '0 6px 18px rgba(27, 32, 64, 0.10)',
    // Bleu de midi vers un horizon doré, qui se fond dans la pierre du fond.
    sky: ['#5FA3D8', '#9CCBEE', '#F3DDBB'] as const,
  },
};

const ToneContext = createContext<Tone>('night');

export const ToneProvider = ToneContext.Provider;

export function useTone(): { tone: Tone; c: ToneColors } {
  const tone = useContext(ToneContext);
  return { tone, c: TONES[tone] };
}
