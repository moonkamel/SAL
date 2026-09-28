import type { StyleProp, ViewStyle } from 'react-native';

import type { LatLng } from '@/shared/types';

// Mapbox (carte native) n'existe pas sur le web : rien à afficher.
export function FollowMap(_: {
  position: LatLng | null;
  target: LatLng | null;
  style?: StyleProp<ViewStyle>;
  bottomPadding?: number;
}) {
  return null;
}
