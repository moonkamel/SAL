// Identité « Lille la nuit » : bleu nuit des façades éclairées, brique flamande,
// or de la Vieille Bourse et pierre crème des pignons de la Grand-Place.

export const palette = {
  night900: '#0A0D1C',
  night800: '#10142A',
  night700: '#171C36',
  night600: '#212845',
  night500: '#2E3658',
  brick: '#D9502F',
  brickDeep: '#A8361C',
  brickGlow: '#F07A4F',
  gold: '#E6B45A',
  goldDeep: '#B8862E',
  stone: '#F5EEE2',
  stoneMuted: '#B9B4C6',
  stoneFaint: '#7A7F9C',
  green: '#5FD39A',
  coral: '#FF7A6B',
} as const;

export const colors = {
  background: palette.night900,
  surface: palette.night800,
  surfaceRaised: palette.night700,
  border: palette.night600,
  text: palette.stone,
  textMuted: palette.stoneMuted,
  textFaint: palette.stoneFaint,
  accent: palette.brick,
  accentText: '#FFFFFF',
  gold: palette.gold,
  open: palette.green,
  closed: palette.coral,
  star: palette.gold,
  sponsored: palette.gold,
  /** Voile sombre posé sur les photos pour garder le texte lisible. */
  scrim: 'rgba(10, 13, 28, 0.85)',
  glass: 'rgba(23, 28, 54, 0.72)',
};

/** Dégradés (expo-linear-gradient) : toujours du haut vers le bas sauf mention. */
export const gradients = {
  /** Ciel nocturne de l'accueil, vers l'horizon légèrement réchauffé. */
  sky: [palette.night900, '#161B3C', '#3A2340'] as const,
  /** Boutons d'action principaux (« Y aller », « Démarrer »), de gauche à droite. */
  brick: [palette.brickGlow, palette.brick, palette.brickDeep] as const,
  /** Bas des photos : transparent → nuit. */
  photo: ['rgba(10,13,28,0)', 'rgba(10,13,28,0.35)', 'rgba(10,13,28,0.92)'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const font = {
  hero: 36,
  title: 22,
  body: 16,
  small: 14,
  tiny: 12,
};

/** Police de titre (Fraunces, un serif au caractère flamand) chargée dans app/_layout.tsx. */
export const fonts = {
  display: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  displayMedium: 'Fraunces_600SemiBold',
};

/** Ombres au format boxShadow (New Architecture). */
export const shadows = {
  card: '0 6px 18px rgba(0, 0, 0, 0.35)',
  raised: '0 10px 28px rgba(0, 0, 0, 0.45)',
  glow: '0 8px 24px rgba(217, 80, 47, 0.45)',
};

/** Durées et ressorts partagés : toutes les animations de l'app se ressemblent. */
export const motion = {
  fast: 150,
  base: 260,
  slow: 420,
  /** Décalage entre deux éléments d'une liste qui apparaît. */
  stagger: 55,
  spring: { damping: 18, stiffness: 260, mass: 0.6 },
};

/** Taille minimale des zones tactiles (recommandation Apple / Material : 44–48 pt). */
export const TOUCH_TARGET = 48;
