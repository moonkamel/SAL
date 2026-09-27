import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette } from '@/src/theme';

import { SILHOUETTE, STARS, WINDOWS } from './skylinePaths';

interface Props {
  style?: StyleProp<ViewStyle>;
}

function Skyline({ style }: Props) {
  return (
    <Svg
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYMax slice"
      style={style}
      accessibilityLabel="Silhouette de Lille : beffroi, Vieille Bourse, Opéra et cathédrale"
    >
      <Defs>
        <LinearGradient id="buildings" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0E1228" />
          <Stop offset="1" stopColor="#06081A" />
        </LinearGradient>
      </Defs>
      {STARS.map(([cx, cy, r]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={palette.stone} opacity={0.55} />
      ))}
      <Circle cx={378} cy={66} r={13} fill={palette.gold} opacity={0.08} />
      <Circle cx={378} cy={66} r={6} fill={palette.stone} opacity={0.9} />
      <Path d={SILHOUETTE} fill="url(#buildings)" fillRule="evenodd" />
      <Path d={WINDOWS} fill={palette.gold} opacity={0.85} />
      {/* Horloge du beffroi. */}
      <Circle cx={134} cy={52} r={3} fill={palette.gold} opacity={0.9} />
    </Svg>
  );
}

export const LilleSkyline = memo(Skyline);
