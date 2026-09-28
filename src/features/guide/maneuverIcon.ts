import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { Maneuver } from '@/shared/guide';

type Icon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Flèche de la manœuvre à venir, façon Citymapper. */
export function maneuverIcon(m: Maneuver): Icon {
  if (m.type === 'arrive') return 'flag-checkered';
  if (m.type === 'depart') return 'navigation-variant';
  if (m.type === 'roundabout' || m.type === 'rotary') return 'rotate-right';
  switch (m.modifier) {
    case 'uturn':
      return 'arrow-u-left-top';
    case 'sharp left':
      return 'arrow-bottom-left';
    case 'left':
      return 'arrow-left-top';
    case 'slight left':
      return 'arrow-top-left';
    case 'slight right':
      return 'arrow-top-right';
    case 'right':
      return 'arrow-right-top';
    case 'sharp right':
      return 'arrow-bottom-right';
    default:
      return 'arrow-up';
  }
}
