import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useT } from '@/src/i18n';
import { palette } from '@/src/theme';

import { SILHOUETTE, STARS, WINDOWS } from './skylinePaths';

interface Props {
  style?: StyleProp<ViewStyle>;
  /** « day » : soleil, nuages et façades de brique ; « night » (défaut) : lune et fenêtres allumées. */
  tone?: 'day' | 'night';
}

/** Petit nuage fait de trois ellipses. */
function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G opacity={0.85}>
      <Ellipse cx={x} cy={y} rx={14 * s} ry={5 * s} fill="#FFFFFF" />
      <Ellipse cx={x - 6 * s} cy={y - 3 * s} rx={7 * s} ry={5 * s} fill="#FFFFFF" />
      <Ellipse cx={x + 5 * s} cy={y - 4 * s} rx={8 * s} ry={6 * s} fill="#FFFFFF" />
    </G>
  );
}

function Skyline({ style, tone = 'night' }: Props) {
  const day = tone === 'day';
  const t = useT();
  return (
    <Svg
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYMax slice"
      style={style}
      accessibilityLabel={t('Silhouette de Lille : beffroi, Vieille Bourse, Opéra et cathédrale')}
    >
      <Defs>
        {/* Brique lilloise le jour, silhouettes sombres la nuit. */}
        <LinearGradient id="buildings" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={day ? '#B4583A' : '#0E1228'} />
          <Stop offset="1" stopColor={day ? '#7E3524' : '#06081A'} />
        </LinearGradient>
        <RadialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFE7A8" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#FFE7A8" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {day ? (
        <>
          <Circle cx={336} cy={34} r={30} fill="url(#sun)" />
          <Circle cx={336} cy={34} r={11} fill="#FFD36B" />
          <Cloud x={70} y={40} s={1} />
          <Cloud x={250} y={26} s={0.8} />
          <Cloud x={320} y={70} s={0.6} />
        </>
      ) : (
        <>
          {STARS.map(([cx, cy, r]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={palette.stone} opacity={0.55} />
          ))}
          <Circle cx={378} cy={66} r={13} fill={palette.gold} opacity={0.08} />
          <Circle cx={378} cy={66} r={6} fill={palette.stone} opacity={0.9} />
        </>
      )}

      <Path d={SILHOUETTE} fill="url(#buildings)" fillRule="evenodd" />
      {/* Fenêtres : allumées la nuit, pierre claire le jour. */}
      <Path d={WINDOWS} fill={day ? '#F3E6CC' : palette.gold} opacity={day ? 0.75 : 0.85} />
      {/* Horloge du beffroi. */}
      <Circle cx={134} cy={52} r={3} fill={day ? '#F3E6CC' : palette.gold} opacity={0.9} />
    </Svg>
  );
}

export const LilleSkyline = memo(Skyline);
